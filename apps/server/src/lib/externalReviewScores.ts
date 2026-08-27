import {
  externalReviewSourcePolicies,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";

/** Owns the rule for external review scores that can enter public summaries. */
export function countedExternalReviewScoreWhere() {
  return and(
    eq(reviews.hidden, false),
    eq(externalReviewSourcePolicies.allowScoreDisplay, true),
    or(
      isNull(reviewArticles.contentHash),
      eq(externalReviewSourcePolicies.publicationMode, "automatic"),
    ),
    eq(reviews.nativeScoreScale, 100),
    sql`${reviews.nativeScoreValue} BETWEEN 0 AND 100`,
    sql`${reviews.nativeScoreValue} = TRUNC(${reviews.nativeScoreValue})`,
  );
}
