import { db } from "@peated/server/db";
import { pushJob, runJob } from "@peated/server/worker/dispatch";
import { z } from "zod";
import type { JobPayload } from "../types";
import type { UpdateBottleStatsJobArgs } from "./updateBottleStats";

export const OnBottleChangeJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
    // Deploy rule (docs/operations/deployments.md): an API released before
    // generated Bottle details were removed still sends this flag. Accept and
    // ignore it until that API and its queued jobs are gone, then delete it.
    generateDetails: z.boolean().optional(),
  })
  .strict();

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
  const { bottleId } = OnBottleChangeJobArgsSchema.parse(input);

  const bottle = await db.query.bottles.findFirst({
    columns: { id: true },
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  // Bottle change jobs can outlive a delete or merge. Missing rows mean that
  // this queued work is stale, so no derived Bottle state remains to update.
  if (!bottle) return;

  await runJob("IndexBottleSearch", { bottleId });
  const statsJob = buildBottleChangeStatsJob(bottleId);
  await pushJob(statsJob.name, statsJob.args, statsJob.opts);
};
