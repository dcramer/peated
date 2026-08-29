import { expect, test } from "vitest";
import { findLikelyListPages } from "./discovery";

test("finds bounded same-site review pages", () => {
  const result = findLikelyListPages({
    kind: "review",
    pageUrl: new URL("https://example.test/"),
    html: `
      <a href="/about">About</a>
      <a href="/reviews">Whisky reviews</a>
      <a href="/reviews/archive">Archive</a>
      <a href="https://other.test/reviews">Other reviews</a>
      <a href="javascript:alert(1)">Bad link</a>
    `,
  });

  expect(result).toEqual([
    "https://example.test/reviews/archive",
    "https://example.test/reviews",
  ]);
});

test("uses store terms only for price sources", () => {
  const html = `
    <a href="/reviews">Reviews</a>
    <a href="/collections/whisky">Shop whisky</a>
  `;

  expect(
    findLikelyListPages({
      kind: "price",
      pageUrl: new URL("https://example.test/"),
      html,
    }),
  ).toEqual(["https://example.test/collections/whisky"]);
});
