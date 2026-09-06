import { createHash } from "node:crypto";
import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

function normalizeKeyPart(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

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
    expectedReviewKey: ({ articleUrl, name, reviewerName }) => {
      const digest = createHash("sha256")
        .update(
          [articleUrl, name, reviewerName ?? ""]
            .map(normalizeKeyPart)
            .join("\n"),
        )
        .digest("hex");
      return `dramface:${digest}`;
    },
  });
}
