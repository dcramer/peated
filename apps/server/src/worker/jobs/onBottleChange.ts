import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import { z } from "zod";
import type { UpdateBottleStatsJobArgs } from "./updateBottleStats";

export const OnBottleChangeJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
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
  bottleId: number,
): BottleChangeStatsJobPlan {
  return {
    name: "UpdateBottleStats",
    args: { bottleId },
    opts: { delay: 5000, removeOnComplete: true, removeOnFail: false },
  };
}

export default async (input: unknown) => {
  const { bottleId } = OnBottleChangeJobArgsSchema.parse(input);

  await runJob("GenerateBottleDetails", { bottleId });
  await runJob("IndexBottleSearchVectors", { bottleId });
  const statsJob = buildBottleChangeStatsJob(bottleId);
  await pushUniqueJob(statsJob.name, statsJob.args, statsJob.opts);
};
