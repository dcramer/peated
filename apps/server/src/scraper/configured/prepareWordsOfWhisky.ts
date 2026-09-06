import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareWordsOfWhiskySource(
  input: PrepareReviewSourceInput,
) {
  return prepareReviewSource(input, {
    siteKey: "wordsofwhisky",
    siteName: "Words of Whisky",
    targetKey: "wordsofwhisky",
    origin: "https://wordsofwhisky.com",
    listUrl: "https://wordsofwhisky.com/",
    allowsMultipleReviews: true,
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/wordsofwhisky\.com\/[a-z0-9][a-z0-9-]*$/.test(url),
  });
}
