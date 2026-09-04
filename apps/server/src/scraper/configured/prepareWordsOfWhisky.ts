import { createHash } from "node:crypto";
import { prepareMultiReviewSource } from "./prepareMultiReviewSource";
import type { PrepareReviewSourceInput } from "./prepareReviewSource";

function normalizeKeyPart(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareWordsOfWhiskySource(
  input: PrepareReviewSourceInput,
) {
  return prepareMultiReviewSource(input, {
    siteKey: "wordsofwhisky",
    siteName: "Words of Whisky",
    targetKey: "wordsofwhisky",
    origin: "https://wordsofwhisky.com",
    listUrl: "https://wordsofwhisky.com/",
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/wordsofwhisky\.com\/[a-z0-9][a-z0-9-]*$/.test(url),
    legacyReviewKey: ({ articleUrl, name, reviewerName }) => {
      const digest = createHash("sha256")
        .update(
          [articleUrl, name, reviewerName ?? ""]
            .map(normalizeKeyPart)
            .join("\n"),
        )
        .digest("hex");
      return `wordsofwhisky:${digest}`;
    },
  });
}
