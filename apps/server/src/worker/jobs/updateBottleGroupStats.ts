import {
  CatalogTargetIntegrityMismatchError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import { z } from "zod";
import { queueCatalogTargetEntityStats } from "./queueCatalogTargetEntityStats";

export const UpdateBottleGroupStatsJobArgsSchema = z
  .object({
    targetId: z.number().int().positive(),
  })
  .strict();
export type UpdateBottleGroupStatsJobArgs = z.infer<
  typeof UpdateBottleGroupStatsJobArgsSchema
>;

/** Recompute one generic target's group and its group-owned entities. */
export default async function updateBottleGroupStats(
  input: unknown,
): Promise<void> {
  const { targetId } = UpdateBottleGroupStatsJobArgsSchema.parse(input);

  try {
    const target = await resolveCatalogTargetForAssignment({
      kind: "target",
      targetId,
    });
    if (target.bottleId !== null) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId },
        "UpdateBottleGroupStats requires a generic BottleGroup target",
      );
    }

    await recomputeBottleGroupStats(target.groupId);
    await queueCatalogTargetEntityStats(target);
  } catch (error) {
    logError(error, {
      job: { name: "UpdateBottleGroupStats" },
      extra: { targetId },
    });
    throw error;
  }
}
