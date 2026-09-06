import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareDramfaceSource(input: PrepareReviewSourceInput) {
  return prepareReviewSource(input, {
    siteKey: "dramface",
    siteName: "Dramface",
    targetKey: "dramface",
    origin: "https://www.dramface.com",
    listUrl: "https://www.dramface.com/all-reviews",
    allowsMultipleReviews: true,
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/www\.dramface\.com\/all-reviews\/\d{4}\/[a-z0-9][a-z0-9-]*$/.test(
        url,
      ),
    oldReviewKeyIsValid: ({ sourceKey }) =>
      /^dramface:[a-f0-9]{64}$/.test(sourceKey ?? ""),
  });
}
