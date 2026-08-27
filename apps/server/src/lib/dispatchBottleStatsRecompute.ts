import { logError } from "@peated/server/lib/log";
import { pushJob } from "@peated/server/worker/client";
import type { UpdateBottleStatsJobArgs } from "@peated/server/worker/jobs/updateBottleStats";

type BottleStatsSource = "externalReview" | "memberReview" | "tasting";

export function buildBottleStatsRecomputeJob(bottleId: number) {
  return {
    name: "UpdateBottleStats" as const,
    args: { bottleId } satisfies UpdateBottleStatsJobArgs,
  };
}

/** Queues a Bottle summary update after the database change finishes. */
export async function dispatchBottleStatsRecompute(
  source: BottleStatsSource,
  sourceId: number,
  bottleId: number,
): Promise<void> {
  const job = buildBottleStatsRecomputeJob(bottleId);
  try {
    await pushJob(job.name, job.args, {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: false,
    });
  } catch (error) {
    logError(error, {
      extra: { job: job.name, source, sourceId, bottleId },
    });
  }
}
