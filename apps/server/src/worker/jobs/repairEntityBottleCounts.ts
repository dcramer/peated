import {
  checkEntityBottleCounts,
  repairEntityBottleCount,
} from "@peated/server/lib/entityBottleCounts";
import { logInfo } from "@peated/server/lib/log";
import { z } from "zod";
import type { JobPayload } from "../types";

export const RepairEntityBottleCountsJobArgsSchema = z.object({}).strict();

export default async function repairEntityBottleCountsJob(input: JobPayload) {
  RepairEntityBottleCountsJobArgsSchema.parse(input);

  const wrongCounts = await checkEntityBottleCounts();
  let repairedCount = 0;

  for (const wrongCount of wrongCounts) {
    if (await repairEntityBottleCount(wrongCount.entityId)) {
      repairedCount += 1;
    }
  }

  logInfo("Finished Bottle count repair", {
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
