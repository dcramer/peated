import { createHash } from "node:crypto";
import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareWhiskyStudySource(
  input: PrepareReviewSourceInput,
) {
  return prepareReviewSource(input, {
    siteKey: "whiskystudy",
    siteName: "The Whisky Study",
    targetKey: "whiskystudy",
    origin: "https://thewhiskystudy.com",
    listUrl: "https://thewhiskystudy.com/reviews-3",
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/thewhiskystudy\.com\/reviews-3\/[a-z0-9][a-z0-9-]*$/.test(
        url,
      ),
    expectedReviewKey: ({ articleUrl }) =>
      `whiskystudy:${createHash("sha256").update(articleUrl).digest("hex")}`,
  });
}
