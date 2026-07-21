import {
  CatalogTargetIntegrityMismatchError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import { z } from "zod";
import type { UpdateBottleStatsJobArgs } from "./updateBottleStats";

export const OnBottleChangeJobArgsSchema = z
  .object({
    targetId: z.number().int().positive(),
  })
  .strict();
export type OnBottleChangeJobArgs = z.infer<typeof OnBottleChangeJobArgsSchema>;

type BottleChangeStatsJobPlan = {
  name: "UpdateBottleStats";
  args: UpdateBottleStatsJobArgs;
  opts: {
    delay: number;
    removeOnComplete: true;
    removeOnFail: false;
  };
};

export function buildBottleChangeStatsJob(
  targetId: number,
): BottleChangeStatsJobPlan {
  return {
    name: "UpdateBottleStats",
    args: { targetId },
    opts: { delay: 5000, removeOnComplete: true, removeOnFail: false },
  };
}

export default async (input: unknown) => {
  const { targetId } = OnBottleChangeJobArgsSchema.parse(input);
  const target = await resolveCatalogTargetForAssignment({
    kind: "target",
    targetId,
  });
  if (target.bottleId === null) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId },
      "OnBottleChange requires an exact Bottle target",
    );
  }

  await runJob("GenerateBottleDetails", { bottleId: target.bottleId });
  await runJob("IndexBottleSearchVectors", { bottleId: target.bottleId });
  const statsJob = buildBottleChangeStatsJob(targetId);
  await pushUniqueJob(statsJob.name, statsJob.args, statsJob.opts);
};
