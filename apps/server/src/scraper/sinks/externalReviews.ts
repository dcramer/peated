import { ingestReviewArticle } from "@peated/server/externalReviews/ingest";
import type { ReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import type { ScraperSink } from "../types";

export const externalReviewSink: ScraperSink<ReviewArticleIngestion> = async ({
  externalSiteId,
  observation,
}) => {
  await ingestReviewArticle({
    externalSiteId,
    fetchedAt: new Date(),
    ...observation.value,
  });
};
