import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import { z } from "zod";
import { queueBottleEntityStats } from "./queueBottleEntityStats";

const UpdateBottleStatsJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
    entityStatsBottleId: z.number().int().positive(),
  })
  .strict();
export type UpdateBottleStatsJobArgs = z.infer<
  typeof UpdateBottleStatsJobArgsSchema
>;

/**
 * Recompute an exact Bottle target and its group. Entity refresh context is the
 * retained tasting Bottle for tasting jobs or the changed Bottle for
 * OnBottleChange; it does not select the statistics target.
 */
export default async function updateBottleStats(input: unknown): Promise<void> {
  const { bottleId, entityStatsBottleId } =
    UpdateBottleStatsJobArgsSchema.parse(input);

  try {
    const bottle = await recomputeBottleStats(bottleId);

    await recomputeBottleGroupStats(bottle.groupId);
    await queueBottleEntityStats(entityStatsBottleId);
  } catch (error) {
    logError(error, {
      job: { name: "UpdateBottleStats" },
      bottle: { id: bottleId },
      extra: { entityStatsBottleId },
    });
    throw error;
  }
}
