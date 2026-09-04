import { createHash } from "node:crypto";
import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareBourbonCultureSource(
  input: PrepareReviewSourceInput,
) {
  return prepareReviewSource(input, {
    siteKey: "bourbonculture",
    siteName: "Bourbon Culture",
    targetKey: "bourbonculture",
    origin: "https://thebourbonculture.com",
    listUrl: "https://thebourbonculture.com/",
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/thebourbonculture\.com\/whiskey-reviews\/[a-z0-9][a-z0-9-]*\/$/.test(
        url,
      ),
    expectedReviewKey: ({ articleUrl }) =>
      `bourbonculture:${createHash("sha256").update(articleUrl).digest("hex")}`,
  });
}
