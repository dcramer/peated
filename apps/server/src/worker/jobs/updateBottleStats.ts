import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import { z } from "zod";
import { queueBottleEntityStats } from "./queueBottleEntityStats";

export const UpdateBottleStatsJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
  })
  .strict();
export type UpdateBottleStatsJobArgs = z.infer<
  typeof UpdateBottleStatsJobArgsSchema
>;

/** Recompute one Bottle, its current group, and its Bottle-owned entities. */
export default async function updateBottleStats(input: unknown): Promise<void> {
  const { bottleId } = UpdateBottleStatsJobArgsSchema.parse(input);

  try {
    const bottle = await recomputeBottleStats(bottleId);

    await recomputeBottleGroupStats(bottle.groupId);
    await queueBottleEntityStats(bottleId);
  } catch (error) {
    logError(error, {
      job: { name: "UpdateBottleStats" },
      extra: { bottleId },
    });
    throw error;
  }
}
