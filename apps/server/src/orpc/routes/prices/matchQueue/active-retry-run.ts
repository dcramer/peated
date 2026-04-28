import { db } from "@peated/server/db";
import { storePriceMatchRetryRuns } from "@peated/server/db/schema";
import { serializeStorePriceMatchRetryRun } from "@peated/server/lib/storePriceMatchRetryRuns";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { PriceMatchRetryRunSchema } from "./retry-run-schema";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/prices/match-queue/retry-runs/active",
    summary: "Get active price match retry run",
    description:
      "Retrieve the currently active background price match retry run, if any. Requires moderator privileges",
    operationId: "getActivePriceMatchRetryRun",
  })
  .output(
    z.object({
      run: PriceMatchRetryRunSchema.nullable(),
    }),
  )
  .handler(async function () {
    const run = await db.query.storePriceMatchRetryRuns.findFirst({
      orderBy: desc(storePriceMatchRetryRuns.createdAt),
      where: inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
    });

    return {
      run: run ? serializeStorePriceMatchRetryRun(run) : null,
    };
  });
