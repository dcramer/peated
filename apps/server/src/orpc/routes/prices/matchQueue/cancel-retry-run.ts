import {
  cancelStorePriceMatchRetryRun,
  serializeStorePriceMatchRetryRun,
} from "@peated/server/lib/storePriceMatchRetryRuns";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";
import { PriceMatchRetryRunSchema } from "./retry-run-schema";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/retry-runs/{run}/cancel",
    summary: "Cancel price match retry run",
    description:
      "Cancel a background price match retry run. Requires moderator privileges",
    operationId: "cancelPriceMatchRetryRun",
  })
  .input(
    z.object({
      run: z.coerce.number(),
    }),
  )
  .output(PriceMatchRetryRunSchema)
  .handler(async function ({ input, errors }) {
    const run = await cancelStorePriceMatchRetryRun(input.run);

    if (!run) {
      throw errors.NOT_FOUND({
        message: "Retry run not found.",
      });
    }

    return serializeStorePriceMatchRetryRun(run);
  });
