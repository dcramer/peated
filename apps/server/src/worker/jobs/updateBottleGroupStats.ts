import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import { z } from "zod";
import { queueBottleEntityStats } from "./queueBottleEntityStats";

const UpdateBottleGroupStatsJobArgsSchema = z
  .object({
    groupId: z.number().int().positive(),
    entityStatsBottleId: z.number().int().positive(),
  })
  .strict();
export type UpdateBottleGroupStatsJobArgs = z.infer<
  typeof UpdateBottleGroupStatsJobArgsSchema
>;

/**
 * Recompute group statistics; the retained Bottle only supplies legacy entity
 * refresh context and never selects a representative or group calculation.
 */
export default async function updateBottleGroupStats(
  input: unknown,
): Promise<void> {
  const { groupId, entityStatsBottleId } =
    UpdateBottleGroupStatsJobArgsSchema.parse(input);

  try {
    await recomputeBottleGroupStats(groupId);
    await queueBottleEntityStats(entityStatsBottleId);
  } catch (error) {
    logError(error, {
      job: { name: "UpdateBottleGroupStats" },
      bottleGroup: { id: groupId },
      bottle: { id: entityStatsBottleId },
    });
    throw error;
  }
}
