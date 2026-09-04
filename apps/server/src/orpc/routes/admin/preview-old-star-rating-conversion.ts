import { previewOldStarRatingConversion } from "@peated/server/lib/oldStarRatingConversion";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  OldStarRatingConversionReportSchema,
  serializeOldStarRatingConversionReport,
} from "./old-star-rating-conversion-schema";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/tastings/star-rating-conversion",
    summary: "Preview old star rating conversion",
    description:
      "Count old star ratings and show how they would change. Makes no changes. Administrator only.",
    operationId: "getOldStarRatingConversion",
  })
  .output(OldStarRatingConversionReportSchema)
  .handler(async () =>
    serializeOldStarRatingConversionReport(
      await previewOldStarRatingConversion(),
    ),
  );
