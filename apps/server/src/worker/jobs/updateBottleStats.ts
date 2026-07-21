import {
  CatalogTargetIntegrityMismatchError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import { z } from "zod";
import { queueCatalogTargetEntityStats } from "./queueCatalogTargetEntityStats";

export const UpdateBottleStatsJobArgsSchema = z
  .object({
    targetId: z.number().int().positive(),
  })
  .strict();
export type UpdateBottleStatsJobArgs = z.infer<
  typeof UpdateBottleStatsJobArgsSchema
>;

/** Recompute one exact target, its group, and its target-owned entities. */
export default async function updateBottleStats(input: unknown): Promise<void> {
  const { targetId } = UpdateBottleStatsJobArgsSchema.parse(input);

  try {
    const target = await resolveCatalogTargetForAssignment({
      kind: "target",
      targetId,
    });
    if (target.bottleId === null) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId },
        "UpdateBottleStats requires an exact Bottle target",
      );
    }

    const bottle = await recomputeBottleStats(target.bottleId);

    await recomputeBottleGroupStats(bottle.groupId);
    await queueCatalogTargetEntityStats(target);
  } catch (error) {
    logError(error, {
      job: { name: "UpdateBottleStats" },
      extra: { targetId },
    });
    throw error;
  }
}
