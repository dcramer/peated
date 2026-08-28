import {
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
} from "@peated/server/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";

/** Owns the rule for external review scores that can enter public summaries. */
export function countedExternalReviewScoreWhere() {
  return and(
    eq(externalReviews.hidden, false),
    eq(externalReviewSourcePolicies.allowScoreDisplay, true),
    or(
      isNull(externalReviewArticles.contentHash),
      eq(externalReviewSourcePolicies.publicationMode, "automatic"),
    ),
    eq(externalReviews.nativeScoreScale, 100),
    sql`${externalReviews.nativeScoreValue} BETWEEN 0 AND 100`,
    sql`${externalReviews.nativeScoreValue} = TRUNC(${externalReviews.nativeScoreValue})`,
  );
}
