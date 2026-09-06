import { logError } from "@peated/server/lib/log";
import { pushJob } from "@peated/server/worker/dispatch";
import type { UpdateBottleStatsJobArgs } from "@peated/server/worker/jobs/updateBottleStats";

type BottleStatsSource =
  | "externalReview"
  | "memberReview"
  | "tasting"
  | "tag"
  | "userPrivacy";

export function buildBottleStatsRecomputeJob(bottleId: number) {
  return {
    name: "UpdateBottleStats" as const,
    args: { bottleId } satisfies UpdateBottleStatsJobArgs,
  };
}

/** Queues a Bottle summary update after the database change finishes. */
export async function dispatchBottleStatsRecompute(
  source: BottleStatsSource,
  sourceId: number | string,
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

/** Queues distinct Bottle summary updates without flooding the worker client. */
export async function dispatchBottleStatsRecomputes(
  source: BottleStatsSource,
  sourceId: number | string,
  bottleIds: readonly number[],
): Promise<void> {
  const ids = [...new Set(bottleIds)].sort((left, right) => left - right);
  for (let offset = 0; offset < ids.length; offset += 50) {
    await Promise.all(
      ids
        .slice(offset, offset + 50)
        .map((bottleId) =>
          dispatchBottleStatsRecompute(source, sourceId, bottleId),
        ),
    );
  }
}
