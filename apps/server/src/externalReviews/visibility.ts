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
    or(
      isNull(externalReviewArticles.contentHash),
      isNotNull(externalReviewPublications.approvedAt),
    ),
  );
}
