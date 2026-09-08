import { expect, test } from "vitest";
import {
  findAdvertisedSyndicationPages,
  findLikelyDetailPages,
  findLikelyListPages,
  inspectSyndicationFeed,
} from "./discovery";

const DETAIL_PAGE_LIMIT = 3;

test("finds Whiskyfun's advertised RSS page without guessing its URL", () => {
  expect(
    findAdvertisedSyndicationPages({
      pageUrl: new URL("https://www.whiskyfun.com/"),
      html: `
        <link rel="alternate" type="application/rss+xml" href="whatsnew.xml">
        <map><area href="whatsnew.xml"></map>
      `,
    }),
  ).toEqual(["https://www.whiskyfun.com/whatsnew.xml"]);
});

test("prioritizes standard feed metadata and keeps discovery on the website", () => {
  expect(
    findAdvertisedSyndicationPages({
      pageUrl: new URL("https://example.test/"),
      html: `
        <a href="/reviews.xml">Review XML</a>
        <link rel="alternate" type="application/atom+xml" href="/feed">
        <link rel="alternate" type="application/rss+xml" href="https://other.test/feed.xml">
        <link rel="alternate" type="text/html" href="/print">
      `,
    }),
  ).toEqual(["https://example.test/feed", "https://example.test/reviews.xml"]);
});

test("validates RSS, Atom, and RDF feeds with same-site article links", () => {
  const pageUrl = new URL("https://example.test/feed.xml");
  expect(
    inspectSyndicationFeed({
      pageUrl,
      xml: "<rss><channel><item><link>/reviews/one</link></item></channel></rss>",
    }),
  ).toEqual({
    format: "rss",
    links: ["https://example.test/reviews/one"],
  });
  expect(
    inspectSyndicationFeed({
      pageUrl,
      xml: '<feed><entry><link rel="alternate" href="/reviews/two"/></entry></feed>',
    }),
  ).toEqual({
    format: "atom",
    links: ["https://example.test/reviews/two"],
  });
  expect(
    inspectSyndicationFeed({
      pageUrl,
      xml: '<rdf:RDF xmlns:rdf="urn:rdf"><item><link>/reviews/three</link></item></rdf:RDF>',
    }),
  ).toEqual({
    format: "rdf",
    links: ["https://example.test/reviews/three"],
  });
});

test("rejects advertised pages that are not usable feeds", () => {
  const pageUrl = new URL("https://example.test/feed.xml");
  expect(
    inspectSyndicationFeed({
      pageUrl,
      xml: '<html><a href="/reviews/one">Review</a></html>',
    }),
  ).toBeNull();
  expect(
    inspectSyndicationFeed({
      pageUrl,
      xml: "<rss><channel><item><link>https://other.test/review</link></item></channel></rss>",
    }),
  ).toBeNull();
});

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

test("uses producer range terms for catalog sources", () => {
  expect(
    findLikelyListPages({
      kind: "catalog",
      pageUrl: new URL("https://example.test/"),
      html: '<a href="/news">News</a><a href="/our-whisky/range">Our whisky range</a>',
    }),
  ).toEqual(["https://example.test/our-whisky/range"]);
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

test("uses validated feed entries as priority detail examples", () => {
  expect(
    findLikelyDetailPages({
      kind: "review",
      limit: 2,
      pages: [
        {
          url: "https://example.test/",
          html: '<article class="review-card"><a href="/reviews/html">HTML review</a></article>',
        },
        {
          url: "https://example.test/feed.xml",
          html: `
            <rss><channel>
              <item><link>https://example.test/reviews/feed-one</link></item>
              <item><link>https://example.test/reviews/feed-two</link></item>
            </channel></rss>
          `,
        },
      ],
    }),
  ).toEqual([
    "https://example.test/reviews/feed-one",
    "https://example.test/reviews/feed-two",
  ]);
});

test("ignores navigation, pagination, supplied pages, and other sites", () => {
  expect(
    findLikelyDetailPages({
      kind: "price",
      limit: DETAIL_PAGE_LIMIT,
      pages: [
        {
          url: "https://example.test/shop",
          html: `
            <a href="/shop">Current page</a>
            <a href="/shop?page=2">Next</a>
            <a href="/account">Account</a>
            <a href="https://other.test/products/one">Other store</a>
            <article class="product-card"><a href="/products/one">Product</a></article>
          `,
        },
      ],
    }),
  ).toEqual(["https://example.test/products/one"]);
});
