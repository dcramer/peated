import {
  checkLocationBottleCounts,
  repairLocationBottleCount,
} from "@peated/server/lib/locationBottleCounts";
import { logInfo } from "@peated/server/lib/log";
import { z } from "zod";
import type { JobPayload } from "../types";

export const RepairLocationBottleCountsJobArgsSchema = z.object({}).strict();

export default async function repairLocationBottleCountsJob(input: JobPayload) {
  RepairLocationBottleCountsJobArgsSchema.parse(input);

  const wrongCounts = await checkLocationBottleCounts();
  let repairedCount = 0;

  for (const wrongCount of wrongCounts) {
    if (await repairLocationBottleCount(wrongCount)) {
      repairedCount += 1;
    }
  }

  logInfo("Finished location Bottle count repair", {
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
