import { createHash } from "node:crypto";
import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareWhiskySagaSource(input: PrepareReviewSourceInput) {
  return prepareReviewSource(input, {
    siteKey: "whiskysaga",
    siteName: "Whisky Saga",
    targetKey: "whiskysaga",
    origin: "https://www.whiskysaga.com",
    listUrl: "https://www.whiskysaga.com/blog/category/Scotland",
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/www\.whiskysaga\.com\/blog\/[a-z0-9][a-z0-9-]*$/.test(url),
    legacyReviewKey: (url) =>
      `whiskysaga:${createHash("sha256").update(url).digest("hex")}`,
  });
}
