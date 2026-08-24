import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import { z } from "zod";
import type { JobPayload } from "../types";
import type { UpdateBottleStatsJobArgs } from "./updateBottleStats";

export const OnBottleChangeJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
    generateDetails: z.boolean().default(false),
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

export default async (input: JobPayload) => {
  const { bottleId, generateDetails } =
    OnBottleChangeJobArgsSchema.parse(input);

  if (generateDetails) {
    await runJob("GenerateBottleDetails", { bottleId });
  }
  await runJob("IndexBottleSearchVectors", { bottleId });
  const statsJob = buildBottleChangeStatsJob(bottleId);
  await pushUniqueJob(statsJob.name, statsJob.args, statsJob.opts);
};
