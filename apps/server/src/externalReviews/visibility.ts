import {
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
} from "@peated/server/db/schema";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

/** Owns anonymous visibility for external review records. */
export function visibleExternalReviewWhere() {
  return and(
    eq(externalReviews.hidden, false),
    isNull(externalReviews.removedAt),
    or(
      isNotNull(externalReviewPublications.approvedAt),
      and(
        isNull(externalReviewPublications.externalSiteId),
        isNull(externalReviewArticles.contentHash),
      ),
    ),
  );
}
