import {
  createExternalReview,
  ExternalReviewBottleStateError,
} from "@peated/server/lib/createExternalReview";
import { logWarn } from "@peated/server/lib/log";
import type { BottleReview } from "@peated/server/lib/scraper";
import type { ScraperSink } from "../types";

export const whiskyAdvocateReviewSink: ScraperSink<BottleReview> = async ({
  observation,
}) => {
  try {
    await createExternalReview({
      site: "whiskyadvocate",
      ...observation.value,
    });
  } catch (error) {
    if (!(error instanceof ExternalReviewBottleStateError)) throw error;

    logWarn("[Whisky Advocate] Skipping review for unavailable bottle", {
      extra: {
        bottleId: error.bottleId,
        name: observation.value.name,
        reason: error.reason,
      },
    });
  }
};
