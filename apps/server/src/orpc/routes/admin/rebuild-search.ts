import { db } from "@peated/server/db";
import { bottleSeries, bottles, entities } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";

const SEARCH_SCOPES = {
  bottles: {
    id: bottles.id,
    table: bottles,
    missingDocuments: or(
      eq(bottles.searchNames, ""),
      eq(bottles.searchTerms, ""),
    ),
    queue: (bottleId: number) =>
      pushUniqueJob("IndexBottleSearchVectors", { bottleId }, { delay: 0 }),
  },
  entities: {
    id: entities.id,
    table: entities,
    missingDocuments: eq(entities.searchNames, ""),
    queue: (entityId: number) =>
      pushUniqueJob("IndexEntitySearchVectors", { entityId }, { delay: 0 }),
  },
  series: {
    id: bottleSeries.id,
    table: bottleSeries,
    missingDocuments: eq(bottleSeries.searchNames, ""),
    queue: (seriesId: number) =>
      pushUniqueJob(
        "IndexBottleSeriesSearchVectors",
        { seriesId },
        { delay: 0 },
      ),
  },
};

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/rebuild-search",
    summary: "Queue a page of search documents for rebuilding",
    description:
      "Queue a bounded page of search-document rebuilds for Bottles, Entities, or Series, optionally only for records that still have no documents. Requires administrator privileges.",
    operationId: "rebuildSearch",
  })
  .input(
    z
      .object({
        scope: z.enum(["bottles", "entities", "series"]).default("bottles"),
        afterId: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(100).default(100),
        missingOnly: z.boolean().default(false),
      })
      .strict(),
  )
  .output(z.object({ queued: z.number(), nextAfterId: z.number().nullable() }))
  .handler(async ({ input }) => {
    const scope = SEARCH_SCOPES[input.scope];
    const rows = await db
      .select({ id: scope.id })
      .from(scope.table)
      .where(
        and(
          gt(scope.id, input.afterId),
          // Repair path: queued index jobs are not durable across a Redis
          // reset, so an operator can re-queue only records still missing
          // search documents instead of the whole catalog.
          input.missingOnly ? scope.missingDocuments : undefined,
        ),
      )
      .orderBy(asc(scope.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    for (const row of page) {
      await scope.queue(row.id);
    }
    return {
      queued: page.length,
      nextAfterId: rows.length > input.limit ? page.at(-1)!.id : null,
    };
  });
