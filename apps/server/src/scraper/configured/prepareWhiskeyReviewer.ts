import { createHash } from "node:crypto";
import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareWhiskeyReviewerSource(
  input: PrepareReviewSourceInput,
) {
  return prepareReviewSource(input, {
    siteKey: "whiskeyreviewer",
    siteName: "The Whiskey Reviewer",
    targetKey: "whiskeyreviewer",
    origin: "https://whiskeyreviewer.com",
    listUrl: "https://whiskeyreviewer.com/",
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/whiskeyreviewer\.com\/\d{4}\/\d{2}\/[a-z0-9][a-z0-9-]*-\d{6}$/.test(
        url,
      ),
    expectedReviewKey: ({ articleUrl }) =>
      `whiskeyreviewer:${createHash("sha256").update(articleUrl).digest("hex")}`,
  });
}
