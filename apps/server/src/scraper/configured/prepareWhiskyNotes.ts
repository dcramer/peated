import { createHash } from "node:crypto";
import {
  prepareReviewSource,
  type PrepareReviewSourceInput,
} from "./prepareReviewSource";

function normalizeKeyPart(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

/** Checks one source by default; applying keeps record IDs and leaves collection paused. */
export async function prepareWhiskyNotesSource(
  input: PrepareReviewSourceInput,
) {
  return prepareReviewSource(input, {
    siteKey: "whiskynotes",
    siteName: "WhiskyNotes",
    targetKey: "whiskynotes",
    origin: "https://www.whiskynotes.be",
    listUrl: "https://www.whiskynotes.be/",
    allowsMultipleReviews: true,
    isCanonicalArticleUrl: (url) =>
      /^https:\/\/www\.whiskynotes\.be\/\d{4}\/[^/]+\/[^/]+\/$/.test(url),
    expectedReviewKey: ({ articleUrl, name }) => {
      const digest = createHash("sha256")
        .update(`${articleUrl}\n${normalizeKeyPart(name)}`)
        .digest("hex");
      return `whiskynotes:${digest}`;
    },
  });
}
