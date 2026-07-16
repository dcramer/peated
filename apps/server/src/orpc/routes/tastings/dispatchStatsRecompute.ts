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

/**
 * Route exact targets to Bottle stats and generic targets to group stats.
 * target.bottleId is the validated exact scope for target.targetId;
 * entityStatsBottleId is retained legacy entity context in both branches and
 * never selects group calculations.
 */
export function buildTastingStatsRecomputeJob(
  target: CatalogTargetAssignmentDescriptor,
  entityStatsBottleId: number,
): TastingStatsRecomputeJob {
  return target.bottleId !== null
    ? {
        name: "UpdateBottleStats",
        args: { bottleId: target.bottleId, entityStatsBottleId },
      }
    : {
        name: "UpdateBottleGroupStats",
        args: { groupId: target.groupId, entityStatsBottleId },
      };
}

/**
 * Queue recomputation after commit. Both jobs carry the retained tasting Bottle
 * only for legacy entity refresh, never as a group representative or group
 * calculation input. Publication failures are logged and swallowed because the
 * write is durable.
 */
export async function dispatchTastingStatsRecompute(
  tastingId: number,
  target: CatalogTargetAssignmentDescriptor,
  entityStatsBottleId: number,
): Promise<void> {
  const job = buildTastingStatsRecomputeJob(target, entityStatsBottleId);

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
        entityStatsBottleId,
        targetBottleId: target.bottleId,
      },
    });
  }
}
