import {
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
} from "@peated/server/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";

/** Owns anonymous visibility for external review records. */
export function visibleExternalReviewWhere() {
  return and(
    eq(externalReviews.hidden, false),
    or(
      isNull(externalReviewArticles.contentHash),
      eq(externalReviewSourcePolicies.publicationMode, "automatic"),
    ),
  );
}
