import { ingestReviewArticle } from "@peated/server/externalReviews/ingest";
import { createHash } from "node:crypto";
import type { WhiskyAdvocateObservation } from "../adapters/whiskyAdvocate";
import type { WhiskyNotesObservation } from "../adapters/whiskyNotes";
import type { ScraperSink } from "../types";

export const whiskyAdvocateReviewSink: ScraperSink<
  WhiskyAdvocateObservation
> = async ({ externalSiteId, observation }) => {
  const { name, category, rating, url, issue } = observation.value;
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ name, category, rating, url, issue }))
    .digest("hex");

  await ingestReviewArticle({
    externalSiteId,
    fetchedAt: new Date(),
    article: {
      canonicalUrl: url,
      title: name,
      issue,
      publishedAt: null,
      contentHash,
      reviews: [
        {
          sourceKey: observation.sourceKey,
          name,
          category,
          reviewerName: null,
          nativeScore: {
            value: rating,
            scale: 100,
            display: `${rating}/100`,
          },
          normalizedRating: Math.round(rating),
        },
      ],
    },
    reviewTexts: {},
  });
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
