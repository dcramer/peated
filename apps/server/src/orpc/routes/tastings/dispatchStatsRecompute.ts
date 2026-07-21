import type { CatalogTargetAssignmentDescriptor } from "@peated/server/lib/catalogTargets";
import { logError } from "@peated/server/lib/log";
import { pushJob } from "@peated/server/worker/client";
import type { UpdateBottleGroupStatsJobArgs } from "@peated/server/worker/jobs/updateBottleGroupStats";
import type { UpdateBottleStatsJobArgs } from "@peated/server/worker/jobs/updateBottleStats";

type TastingStatsRecomputeJob =
  | {
      name: "UpdateBottleStats";
      args: UpdateBottleStatsJobArgs;
    }
  | {
      name: "UpdateBottleGroupStats";
      args: UpdateBottleGroupStatsJobArgs;
    };

/** Route exact and generic target identities to their dedicated workers. */
export function buildTastingStatsRecomputeJob(
  target: CatalogTargetAssignmentDescriptor,
): TastingStatsRecomputeJob {
  return target.bottleId !== null
    ? {
        name: "UpdateBottleStats",
        args: { targetId: target.targetId },
      }
    : {
        name: "UpdateBottleGroupStats",
        args: { targetId: target.targetId },
      };
}

/**
 * Queue recomputation after commit. Publication failures are logged and
 * swallowed because the authoritative tasting write is already durable.
 */
export async function dispatchTastingStatsRecompute(
  tastingId: number,
  target: CatalogTargetAssignmentDescriptor,
): Promise<void> {
  const job = buildTastingStatsRecomputeJob(target);

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
        targetId: target.targetId,
        groupId: target.groupId,
        targetBottleId: target.bottleId,
      },
    });
  }
}
