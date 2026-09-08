import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

const CURRENT_ARTICLE_URL =
  /^https:\/\/www\.whiskyfun\.com\/\d{4}\/[^/?#]+\.html$/;
const ARCHIVE_ARTICLE_URL =
  /^https:\/\/www\.whiskyfun\.com\/archive(?:january|february|march|april|avril|may|june|july|august|september|october|november|december)\d{2}-[12](?:-[^/?#]+)?\.html#\d{6}$/i;

/** Checks Whiskyfun's existing reviews; applying keeps record IDs and pauses collection. */
export async function prepareWhiskyfunSource(input: PrepareReviewSourceInput) {
  return prepareReviewSource(input, {
    siteKey: "whiskyfun",
    siteName: "Whiskyfun",
    targetKey: "whiskyfun",
    origin: "https://www.whiskyfun.com",
    listUrl: "https://www.whiskyfun.com/whatsnew.xml",
    allowsMultipleReviews: true,
    isCanonicalArticleUrl: (url) =>
      CURRENT_ARTICLE_URL.test(url) || ARCHIVE_ARTICLE_URL.test(url),
  });
}
