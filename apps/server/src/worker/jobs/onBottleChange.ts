import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import type { UpdateBottleStatsJobArgs } from "./updateBottleStats";

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
    args: { bottleId, entityStatsBottleId: bottleId },
    opts: { delay: 5000, removeOnComplete: true, removeOnFail: false },
  };
}

export default async ({ bottleId }: { bottleId: number }) => {
  await runJob("GenerateBottleDetails", { bottleId });
  await runJob("IndexBottleSearchVectors", { bottleId });
  const statsJob = buildBottleChangeStatsJob(bottleId);
  await pushUniqueJob(statsJob.name, statsJob.args, statsJob.opts);
};
