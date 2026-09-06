import { createHash } from "node:crypto";

function normalizeReviewKeyPart(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

/** Saved-review identity rule: names and writers, not page order, own the key. */
export function reviewSourceKey(
  name: string,
  reviewerName: string | null,
  repeatedReviewNumber = 1,
) {
  const digest = createHash("sha256")
    .update([name, reviewerName ?? ""].map(normalizeReviewKeyPart).join("\n"))
    .digest("hex");
  const baseKey = `review:${digest}`;
  return repeatedReviewNumber === 1
    ? baseKey
    : `${baseKey}:${repeatedReviewNumber}`;
}
