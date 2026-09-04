import {
  checkBottleSeriesReleaseCounts,
  repairBottleSeriesReleaseCount,
} from "@peated/server/lib/bottleSeriesReleaseCounts";
import { logInfo } from "@peated/server/lib/log";
import { z } from "zod";
import type { JobPayload } from "../types";

export const RepairBottleSeriesReleaseCountsJobArgsSchema = z
  .object({})
  .strict();

export default async function repairBottleSeriesReleaseCountsJob(
  input: JobPayload,
) {
  RepairBottleSeriesReleaseCountsJobArgsSchema.parse(input);

  const wrongCounts = await checkBottleSeriesReleaseCounts();
  let repairedCount = 0;

  for (const wrongCount of wrongCounts) {
    if (await repairBottleSeriesReleaseCount(wrongCount.seriesId)) {
      repairedCount += 1;
    }
  }

  logInfo("Finished BottleSeries release count repair", {
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
