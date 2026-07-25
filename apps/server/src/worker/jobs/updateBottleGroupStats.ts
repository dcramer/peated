import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import { z } from "zod";
import { queueBottleGroupEntityStats } from "./queueBottleEntityStats";

export const UpdateBottleGroupStatsJobArgsSchema = z
  .object({
    groupId: z.number().int().positive(),
  })
  .strict();
export type UpdateBottleGroupStatsJobArgs = z.infer<
  typeof UpdateBottleGroupStatsJobArgsSchema
>;

/** Recompute one BottleGroup and its group-owned entities. */
export default async function updateBottleGroupStats(
  input: unknown,
): Promise<void> {
  const { groupId } = UpdateBottleGroupStatsJobArgsSchema.parse(input);

  try {
    await recomputeBottleGroupStats(groupId);
    await queueBottleGroupEntityStats(groupId);
  } catch (error) {
    logError(error, {
      job: { name: "UpdateBottleGroupStats" },
      extra: { groupId },
    });
    throw error;
  }
}
