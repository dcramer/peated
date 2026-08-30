import {
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
} from "@peated/server/db/schema";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

/** Owns the rule for external review scores that can enter public summaries. */
export function countedExternalReviewScoreWhere() {
  return and(
    eq(externalReviews.hidden, false),
    or(
      isNull(externalReviewArticles.contentHash),
      isNotNull(externalReviewPublications.approvedAt),
    ),
    eq(externalReviews.nativeScoreScale, 100),
    sql`${externalReviews.nativeScoreValue} BETWEEN 0 AND 100`,
    sql`${externalReviews.nativeScoreValue} = TRUNC(${externalReviews.nativeScoreValue})`,
  );
}
