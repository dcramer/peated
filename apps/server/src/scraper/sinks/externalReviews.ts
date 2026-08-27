import { ingestExternalReviewArticle } from "@peated/server/externalReviews/ingest";
import type { ExternalReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import type { ScraperSink } from "../types";

export const externalReviewSink: ScraperSink<
  ExternalReviewArticleIngestion
> = async ({ externalSiteId, observation }) => {
  await ingestExternalReviewArticle({
    externalSiteId,
    fetchedAt: new Date(),
    ...observation.value,
  });
};
