import { logError } from "@peated/server/lib/log";
import { pushJob } from "@peated/server/worker/client";
import type { UpdateBottleStatsJobArgs } from "@peated/server/worker/jobs/updateBottleStats";

type TastingStatsRecomputeJob = {
  name: "UpdateBottleStats";
  args: UpdateBottleStatsJobArgs;
};

/** Builds direct-Bottle aggregate work for a persisted Tasting change. */
export function buildTastingStatsRecomputeJob(
  bottleId: number,
): TastingStatsRecomputeJob {
  return {
    name: "UpdateBottleStats",
    args: { bottleId },
  };
}

/**
 * Queue recomputation after commit. Publication failures are logged and
 * swallowed because the authoritative tasting write is already durable.
 */
export async function dispatchTastingStatsRecompute(
  tastingId: number,
  bottleId: number,
): Promise<void> {
  const job = buildTastingStatsRecomputeJob(bottleId);

  try {
    await pushJob(job.name, job.args, {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: false,
    });
  } catch (error) {
    logError(error, {
      extra: {
        job: job.name,
        tastingId,
        bottleId,
      },
    });
  }
}
