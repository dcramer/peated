import { logInfo } from "@peated/server/lib/log";
import {
  checkBottleGroupBottleCounts,
  repairBottleGroupBottleCount,
} from "@peated/server/lib/recomputeBottleGroupStats";
import { z } from "zod";
import type { JobPayload } from "../types";

export const RepairBottleGroupBottleCountsJobArgsSchema = z.object({}).strict();

export default async function repairBottleGroupBottleCountsJob(
  input: JobPayload,
) {
  RepairBottleGroupBottleCountsJobArgsSchema.parse(input);

  const wrongCounts = await checkBottleGroupBottleCounts();
  let repairedCount = 0;

  for (const wrongCount of wrongCounts) {
    if (await repairBottleGroupBottleCount(wrongCount.groupId)) {
      repairedCount += 1;
    }
  }

  logInfo("Finished BottleGroup count repair", {
    extra: {
      wrongCount: wrongCounts.length,
      repairedCount,
    },
  });

  return {
    wrongCount: wrongCounts.length,
    repairedCount,
  };
}
