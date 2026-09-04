import type { OldStarRatingConversionReport } from "@peated/server/lib/oldStarRatingConversion";
import { z } from "zod";

export const OldStarRatingConversionReportSchema = z
  .object({
    oldStarRatings: z.number().int().nonnegative(),
    willConvert: z.number().int().nonnegative(),
    alreadyRated: z.number().int().nonnegative(),
    notConverted: z.number().int().nonnegative(),
    converted: z.number().int().nonnegative(),
    bottles: z.number().int().nonnegative(),
    bottleTotalsStarted: z.number().int().nonnegative(),
    bottleTotalsFailed: z.number().int().nonnegative(),
    ratings: z
      .object({
        mediocre: z.number().int().nonnegative(),
        good: z.number().int().nonnegative(),
        very_good: z.number().int().nonnegative(),
        outstanding: z.number().int().nonnegative(),
        unicorn: z.number().int().nonnegative(),
      })
      .strict(),
    notConvertedValues: z.record(z.string(), z.number().int().positive()),
  })
  .strict();

export function serializeOldStarRatingConversionReport(
  report: OldStarRatingConversionReport,
  bottleTotals: { failed: number; started: number } = {
    failed: 0,
    started: 0,
  },
) {
  return {
    oldStarRatings: report.oldStarRatings,
    willConvert: report.willConvert,
    alreadyRated: report.alreadyRated,
    notConverted: report.notConverted,
    converted: report.converted,
    bottles: report.bottleIds.length,
    bottleTotalsStarted: bottleTotals.started,
    bottleTotalsFailed: bottleTotals.failed,
    ratings: report.ratings,
    notConvertedValues: report.notConvertedValues,
  };
}
