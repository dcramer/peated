import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/rebuild-bottle-search",
    summary: "Queue a page of Bottle search documents for rebuilding",
    description:
      "Queue a bounded page of search-document rebuilds, optionally only for Bottles that still have no documents. Requires administrator privileges.",
    operationId: "rebuildBottleSearch",
  })
  .input(
    z
      .object({
        afterId: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(100).default(100),
        missingOnly: z.boolean().default(false),
      })
      .strict(),
  )
  .output(z.object({ queued: z.number(), nextAfterId: z.number().nullable() }))
  .handler(async ({ input }) => {
    const rows = await db
      .select({ id: bottles.id })
      .from(bottles)
      .where(
        and(
          gt(bottles.id, input.afterId),
          // Repair path: queued index jobs are not durable across a Redis
          // reset, so an operator can re-queue only Bottles still missing
          // search documents instead of the whole catalog.
          input.missingOnly
            ? or(eq(bottles.searchNames, ""), eq(bottles.searchTerms, ""))
            : undefined,
        ),
      )
      .orderBy(asc(bottles.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    for (const bottle of page) {
      await pushUniqueJob(
        "IndexBottleSearchVectors",
        { bottleId: bottle.id },
        { delay: 0 },
      );
    }
    return {
      queued: page.length,
      nextAfterId: rows.length > input.limit ? page.at(-1)!.id : null,
    };
  });
