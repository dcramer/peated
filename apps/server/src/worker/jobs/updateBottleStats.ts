import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStats } from "@peated/server/lib/recomputeBottleGroupStats";
import {
  BottleStatsIntegrityError,
  recomputeBottleStats,
} from "@peated/server/lib/recomputeBottleStats";
import { z } from "zod";
import type { JobPayload } from "../types";
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
export default async function updateBottleStats(
  input: JobPayload,
): Promise<void> {
  const { bottleId } = UpdateBottleStatsJobArgsSchema.parse(input);

  try {
    const bottle = await recomputeBottleStats(bottleId);

    await recomputeBottleGroupStats(bottle.groupId);
    await queueBottleEntityStats(bottleId);
  } catch (error) {
    if (
      error instanceof BottleStatsIntegrityError &&
      (error.code === "not_found" || error.code === "retired")
    ) {
      return;
    }
    logError(error, {
      job: { name: "UpdateBottleStats" },
      extra: { bottleId },
    });
    throw error;
  }
}
