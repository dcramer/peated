import {
  checkBottleSeriesReleaseCounts,
  repairBottleSeriesReleaseCount,
} from "@peated/server/lib/bottleSeriesReleaseCounts";
import {
  checkBottleSeriesRepresentatives,
  repairBottleSeriesRepresentative,
} from "@peated/server/lib/bottleSeriesRepresentatives";
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
  const wrongRepresentatives = await checkBottleSeriesRepresentatives();
  let repairedCount = 0;
  let repairedRepresentativeCount = 0;

  for (const wrongCount of wrongCounts) {
    if (await repairBottleSeriesReleaseCount(wrongCount.seriesId)) {
      repairedCount += 1;
    }
  }

  for (const wrongRepresentative of wrongRepresentatives) {
    if (await repairBottleSeriesRepresentative(wrongRepresentative.seriesId)) {
      repairedRepresentativeCount += 1;
    }
  }

  logInfo("Finished BottleSeries aggregate repair", {
    extra: {
      wrongCount: wrongCounts.length,
      repairedCount,
      wrongRepresentativeCount: wrongRepresentatives.length,
      repairedRepresentativeCount,
    },
  });

  return {
    wrongCount: wrongCounts.length,
    repairedCount,
  };
}
