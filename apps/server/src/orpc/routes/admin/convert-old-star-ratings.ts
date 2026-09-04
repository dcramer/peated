import { logError } from "@peated/server/lib/log";
import {
  convertOldStarRatings,
  OldStarRatingConversionConflictError,
  OldStarRatingPreviewChangedError,
} from "@peated/server/lib/oldStarRatingConversion";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushJob } from "@peated/server/worker/dispatch";
import { z } from "zod";
import {
  OldStarRatingConversionReportSchema,
  serializeOldStarRatingConversionReport,
} from "./old-star-rating-conversion-schema";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/tastings/star-rating-conversion",
    summary: "Convert old star ratings",
    description:
      "Convert the old star ratings counted by the latest preview. Then start Bottle rating-total updates and report how many started or failed. Administrator only.",
    operationId: "convertOldStarRatings",
  })
  .input(
    z
      .object({
        expectedConversions: z.number().int().nonnegative(),
      })
      .strict(),
  )
  .output(OldStarRatingConversionReportSchema)
  .handler(async ({ input, errors }) => {
    let report;
    try {
      report = await convertOldStarRatings(input.expectedConversions);
    } catch (error) {
      if (
        error instanceof OldStarRatingPreviewChangedError ||
        error instanceof OldStarRatingConversionConflictError
      ) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    let bottleTotalsStarted = 0;
    for (const bottleId of report.bottleIds) {
      try {
        await pushJob(
          "UpdateBottleStats",
          { bottleId },
          { delay: 5000, removeOnComplete: true, removeOnFail: false },
        );
        bottleTotalsStarted += 1;
      } catch (error) {
        // Background-work policy: this route owns logging after ratings are saved.
        logError(error, {
          extra: { bottleId, operation: "convertOldStarRatings" },
        });
      }
    }

    return serializeOldStarRatingConversionReport(report, {
      failed: report.bottleIds.length - bottleTotalsStarted,
      started: bottleTotalsStarted,
    });
  });
