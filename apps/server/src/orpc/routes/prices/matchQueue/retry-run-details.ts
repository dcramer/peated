import { db } from "@peated/server/db";
import { storePriceMatchRetryRuns } from "@peated/server/db/schema";
import { serializeStorePriceMatchRetryRun } from "@peated/server/lib/storePriceMatchRetryRuns";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PriceMatchRetryRunSchema } from "./retry-run-schema";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/prices/match-queue/retry-runs/{run}",
    summary: "Get price match retry run",
    description:
      "Retrieve progress for a background price match retry run. Requires moderator privileges",
    operationId: "getPriceMatchRetryRun",
  })
  .input(
    z.object({
      run: z.coerce.number(),
    }),
  )
  .output(PriceMatchRetryRunSchema)
  .handler(async function ({ input, errors }) {
    const run = await db.query.storePriceMatchRetryRuns.findFirst({
      where: eq(storePriceMatchRetryRuns.id, input.run),
    });

    if (!run) {
      throw errors.NOT_FOUND({
        message: "Retry run not found.",
      });
    }

    return serializeStorePriceMatchRetryRun(run);
  });
