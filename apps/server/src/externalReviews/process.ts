import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { createReviewClip } from "@peated/server/externalReviews/clip";
import { extractReviewTags } from "@peated/server/externalReviews/extractTags";

// This function owns the version. Bump it when its outputs or tag vocabulary change.
export const CURRENT_REVIEW_VERSION = 1;

export type ReviewVocabulary = Array<{
  name: string;
  synonyms: string[];
}>;

export async function loadReviewVocabulary(): Promise<ReviewVocabulary> {
  return await db
    .select({ name: tags.name, synonyms: tags.synonyms })
    .from(tags);
}

/** Builds every value derived from a saved external review body. */
export async function processExternalReview(
  body: string,
  vocabulary: ReviewVocabulary,
  createClip: typeof createReviewClip = createReviewClip,
) {
  return {
    clip: await createClip(body),
    tags: extractReviewTags(body, vocabulary),
    version: CURRENT_REVIEW_VERSION,
  };
}
