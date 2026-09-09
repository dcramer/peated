import { createHash } from "node:crypto";

function normalizeReviewKeyPart(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

/** A review is matched by its name and writer within an article, never page order. */
export function reviewSourceKey(name: string, reviewerName: string | null) {
  const digest = createHash("sha256")
    .update([name, reviewerName ?? ""].map(normalizeReviewKeyPart).join("\n"))
    .digest("hex");
  return `review:${digest}`;
}
