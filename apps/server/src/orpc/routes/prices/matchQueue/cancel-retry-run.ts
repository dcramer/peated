import { db } from "@peated/server/db";
import { storePriceMatchRetryRuns } from "@peated/server/db/schema";
import { serializeStorePriceMatchRetryRun } from "@peated/server/lib/storePriceMatchRetryRuns";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { PriceMatchRetryRunSchema } from "./retry-run-schema";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/retry-runs/{run}/cancel",
    summary: "Cancel price match retry run",
    description:
      "Request cancellation for a background price match retry run. Requires moderator privileges",
    operationId: "cancelPriceMatchRetryRun",
  })
  .input(
    z.object({
      run: z.coerce.number(),
    }),
  )
  .output(PriceMatchRetryRunSchema)
  .handler(async function ({ input, errors }) {
    const [run] = await db
      .update(storePriceMatchRetryRuns)
      .set({
        cancelRequestedAt: sql`COALESCE(${storePriceMatchRetryRuns.cancelRequestedAt}, NOW())`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRuns.id, input.run),
          inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
        ),
      )
      .returning();

    if (!run) {
      const existingRun = await db.query.storePriceMatchRetryRuns.findFirst({
        where: eq(storePriceMatchRetryRuns.id, input.run),
      });

      if (!existingRun) {
        throw errors.NOT_FOUND({
          message: "Retry run not found.",
        });
      }

      return serializeStorePriceMatchRetryRun(existingRun);
    }

    return serializeStorePriceMatchRetryRun(run);
  });
