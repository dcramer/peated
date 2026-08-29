import { expect, test } from "vitest";
import { findLikelyDetailPages, findLikelyListPages } from "./discovery";

const DETAIL_PAGE_LIMIT = 3;

test("limits same-site review pages", () => {
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

test("limits detail pages found in list-page cards", () => {
  const result = findLikelyDetailPages({
    kind: "review",
    limit: DETAIL_PAGE_LIMIT,
    pages: [
      {
        url: "https://example.test/",
        html: '<a href="/reviews">Reviews</a><a href="/about">About</a>',
      },
      {
        url: "https://example.test/reviews",
        html: Array.from(
          { length: DETAIL_PAGE_LIMIT + 2 },
          (_, index) =>
            `<article class="review-card"><a href="/reviews/${index}">Review ${index}</a></article>`,
        ).join(""),
      },
    ],
  });

  expect(result).toEqual([
    "https://example.test/reviews/0",
    "https://example.test/reviews/1",
    "https://example.test/reviews/2",
  ]);
});

test("ignores navigation, supplied pages, and links on other sites", () => {
  expect(
    findLikelyDetailPages({
      kind: "price",
      limit: DETAIL_PAGE_LIMIT,
      pages: [
        {
          url: "https://example.test/shop",
          html: `
            <a href="/shop">Current page</a>
            <a href="/account">Account</a>
            <a href="https://other.test/products/one">Other store</a>
            <article class="product-card"><a href="/products/one">Product</a></article>
          `,
        },
      ],
    }),
  ).toEqual(["https://example.test/products/one"]);
});
