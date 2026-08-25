import {
  externalReviewSourcePolicies,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { eq, isNull, or } from "drizzle-orm";

// Review routes own public visibility. Migrated reviews remain visible, while
// fetched reviews require a source that permits automatic publication.
export function publicReviewVisibility() {
  return [
    eq(reviews.hidden, false),
    or(
      isNull(reviewArticles.contentHash),
      eq(externalReviewSourcePolicies.publicationMode, "automatic"),
    )!,
  ];
}
