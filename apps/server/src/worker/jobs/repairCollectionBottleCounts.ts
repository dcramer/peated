import {
  checkCollectionBottleCounts,
  repairCollectionBottleCount,
} from "@peated/server/lib/collectionBottleCounts";
import { logInfo } from "@peated/server/lib/log";
import { z } from "zod";
import type { JobPayload } from "../types";

export const RepairCollectionBottleCountsJobArgsSchema = z.object({}).strict();

export default async function repairCollectionBottleCountsJob(
  input: JobPayload,
) {
  RepairCollectionBottleCountsJobArgsSchema.parse(input);

  const wrongCounts = await checkCollectionBottleCounts();
  let repairedCount = 0;

  for (const wrongCount of wrongCounts) {
    if (await repairCollectionBottleCount(wrongCount.collectionId)) {
      repairedCount += 1;
    }
  }

  logInfo("Finished Collection Bottle count repair", {
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
