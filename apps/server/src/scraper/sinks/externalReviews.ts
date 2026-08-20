import { ingestReviewArticle } from "@peated/server/externalReviews/ingest";
import {
  createExternalReview,
  ExternalReviewBottleStateError,
} from "@peated/server/lib/createExternalReview";
import { logWarn } from "@peated/server/lib/log";
import type { WhiskyAdvocateObservation } from "../adapters/whiskyAdvocate";
import type { WhiskyNotesObservation } from "../adapters/whiskyNotes";
import type { ScraperSink } from "../types";

export const whiskyAdvocateReviewSink: ScraperSink<
  WhiskyAdvocateObservation
> = async ({ externalSiteId, observation }) => {
  try {
    await createExternalReview(
      {
        site: "whiskyadvocate",
        ...observation.value,
      },
      {
        externalSiteId,
        sourceKey: observation.sourceKey,
      },
    );
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

export const whiskyNotesReviewSink: ScraperSink<
  WhiskyNotesObservation
> = async ({ externalSiteId, observation }) => {
  await ingestReviewArticle({
    externalSiteId,
    fetchedAt: new Date(),
    ...observation.value,
  });
};
