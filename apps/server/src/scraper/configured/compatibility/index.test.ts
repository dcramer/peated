import type { JsonValue } from "@peated/server/scraper/types";
import { describe, expect, it } from "vitest";
import { loadExecutableScrapeRules } from ".";

const listHtml = '<a class="item" href="/detail">Detail</a>';
const detailHtml = `
  <h1>Example Whisky</h1>
  <time datetime="2026-09-08"></time>
  <article class="review"><h2>Example Whisky</h2><p>Smoke.</p></article>
  <span class="price">£42.50</span>
`;

function earlyReviewRules(): JsonValue {
  return {
    kind: "review",
    list: {
      detailLink: { selector: "a.item", attribute: "href" },
      maxItems: 20,
    },
    detail: {
      title: { selector: "h1" },
      publishedAt: { selector: "time", attribute: "datetime" },
      reviewItem: "article.review",
      name: { selector: "h2" },
    },
  };
}

function savedPriceRules(version: 6 | 7 | 8 | 9): JsonValue {
  const read = (selector: string): JsonValue =>
    version < 8
      ? {
          get: "text",
          selector,
          take: "first",
          startsWith: null,
          clean: null,
        }
      : {
          get: "text",
          selector,
          take: "first",
          match: null,
          addStart: null,
          addEnd: null,
        };
  const fixed: JsonValue =
    version < 8
      ? { get: "fixed", value: "700 ml", clean: null }
      : { get: "fixed", value: "700 ml", addStart: null, addEnd: null };
  return {
    kind: "price",
    products: {
      oneProductPer: "body",
      link: "a.item",
      skipWhen: null,
      nextPage: null,
      limit: 20,
    },
    product: {
      name: { try: [read("h1")] },
      price: { try: [read(".price")] },
      currency: "gbp",
      volume: { try: [fixed] },
      url: null,
      externalProductId: null,
      imageUrl: null,
      barcode: null,
    },
  };
}

function directPriceRules(): JsonValue {
  return {
    kind: "price",
    list: { links: "a.item", nextPage: null, limit: 20 },
    detail: {
      name: "h1",
      price: ".price",
      currency: "gbp",
      volume: 700,
      url: null,
      id: null,
      image: null,
      barcode: null,
    },
  };
}

const fixtures: Array<[number, () => JsonValue]> = [
  [1, earlyReviewRules],
  [3, earlyReviewRules],
  [6, () => savedPriceRules(6)],
  [7, () => savedPriceRules(7)],
  [8, () => savedPriceRules(8)],
  [9, () => savedPriceRules(9)],
  [10, directPriceRules],
  [11, directPriceRules],
];

describe.each(fixtures)("saved rules version %i", (version, fixture) => {
  it("decodes and executes its stored fixture", () => {
    const rules = loadExecutableScrapeRules(version, fixture());

    expect(rules.limit).toBe(20);
    expect(
      rules.parseList(listHtml, new URL("https://example.test/list")),
    ).toMatchObject({
      links: ["https://example.test/detail"],
      issues: [],
    });

    const detail = rules.parseDetail(
      detailHtml,
      new URL("https://example.test/detail"),
    );
    expect(detail.issues).toEqual([]);
    expect(detail.value).toBeTruthy();
  });

  it("owns its list limit", () => {
    const rules = loadExecutableScrapeRules(version, fixture()).withLimit(3);

    expect(rules.limit).toBe(3);
    expect(loadExecutableScrapeRules(version, rules.storedRules).limit).toBe(3);
  });
});

it("keeps positional review keys in version 6", () => {
  const result = loadExecutableScrapeRules(6, {
    kind: "review",
    articles: {
      oneArticlePer: "body",
      link: "a.item",
      skipWhen: null,
      nextPage: null,
      limit: 20,
    },
    article: {
      canonicalUrl: null,
      title: {
        try: [
          {
            get: "text",
            selector: "h1",
            take: "first",
            startsWith: null,
            clean: null,
          },
        ],
      },
      publishedDate: {
        try: [
          {
            get: "attribute",
            selector: "time",
            attribute: "datetime",
            clean: null,
          },
        ],
      },
      reviews: {
        inside: "body",
        oneReviewPer: "element",
        selector: "article.review",
        name: {
          try: [
            {
              get: "text",
              from: "review",
              selector: "h2",
              take: "first",
              startsWith: null,
              clean: null,
            },
          ],
        },
        reviewer: null,
        tastingNotes: null,
        score: null,
      },
    },
  }).parseDetail(detailHtml, new URL("https://example.test/detail"));
  if (result.kind !== "review" || !result.value) {
    throw new Error("Expected a parsed review.");
  }

  expect(result.value.article.externalReviews[0]?.sourceKey).toBe(
    "https://example.test/detail#review-1",
  );
});

it("uses name-and-writer review keys in version 9", () => {
  const savedReviewRules = {
    kind: "review",
    articles: {
      document: "html",
      oneArticlePer: "body",
      link: "a.item",
      skipWhen: null,
      nextPage: null,
      limit: 20,
    },
    article: {
      canonicalUrl: null,
      title: {
        try: [
          {
            get: "text",
            selector: "h1",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
      publishedDate: {
        try: [
          {
            get: "attribute",
            selector: "time",
            attribute: "datetime",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
      reviews: {
        inside: "body",
        oneReviewPer: "element",
        selector: "article.review",
        contains: null,
        name: {
          try: [
            {
              get: "text",
              from: "review",
              selector: "h2",
              take: "first",
              match: null,
              addStart: null,
              addEnd: null,
            },
          ],
        },
        reviewer: null,
        tastingNotes: null,
        score: null,
      },
    },
  } satisfies JsonValue;
  const result = loadExecutableScrapeRules(9, savedReviewRules).parseDetail(
    detailHtml,
    new URL("https://example.test/detail"),
  );
  if (result.kind !== "review" || !result.value) {
    throw new Error("Expected a parsed review.");
  }

  expect(result.value.article.externalReviews[0]?.sourceKey).toMatch(
    /^review:[a-f0-9]{64}$/u,
  );
});

it("rejects versions without a registered compatibility module", () => {
  for (const version of [2, 4, 5, 12]) {
    expect(() =>
      loadExecutableScrapeRules(version, directPriceRules()),
    ).toThrow(`Unsupported scrape rules version: ${version}.`);
  }
});
