import { expect, test } from "vitest";
import {
  parseScrapeRules,
  SCRAPE_RULES_VERSION,
  SCRAPE_SOURCE_MAX_ITEMS,
  SCRAPE_SOURCE_MAX_LIST_PAGES,
  ScrapeRulesSchema,
  ScrapeRulesV1Schema,
  ScrapeRulesV2Schema,
  ScrapeRulesV3Schema,
  ScrapeRulesV4Schema,
  ScrapeRulesV5Schema,
  ScrapeRulesV6Schema,
  ScrapeRulesV7Schema,
  ScrapeValueSchema,
} from "./rules";

function reviewConfig(maxItems: number) {
  return {
    kind: "review",
    list: {
      detailLink: { selector: "a.review", attribute: "href" },
      maxItems,
    },
    detail: {
      title: { selector: "h1" },
      reviewItem: "article.review",
      name: { selector: "h2" },
    },
  };
}

test("bounds list and detail pages", () => {
  const rules = ScrapeRulesSchema.parse({
    kind: "review",
    articles: {
      oneArticlePer: "article",
      link: "a",
      skipWhen: null,
      nextPage: null,
      limit: SCRAPE_SOURCE_MAX_ITEMS,
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
            get: "fixed",
            value: "2026-01-01",
            addStart: null,
            addEnd: null,
          },
        ],
      },
      reviews: {
        inside: "main",
        oneReviewPer: "element",
        selector: "article.review",
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
  });
  if (rules.kind !== "review") throw new Error("Expected review rules.");
  expect(rules.articles.limit).toBe(99);
  expect(parseScrapeRules(8, rules)).toEqual(rules);
  expect(() =>
    ScrapeRulesSchema.parse({
      ...rules,
      articles: {
        ...rules.articles,
        limit: SCRAPE_SOURCE_MAX_ITEMS + 1,
      },
    }),
  ).toThrow();
  expect(SCRAPE_SOURCE_MAX_LIST_PAGES).toBe(5);
});

test("rejects rules for an unsupported stored format", () => {
  const rules = ScrapeRulesV5Schema.parse(reviewConfig(25));
  expect(() => parseScrapeRules(9, rules)).toThrow(
    "Unsupported scrape rules version: 9.",
  );
});

test("loads old rules only through the version 1 contract", () => {
  const rules = ScrapeRulesV1Schema.parse(reviewConfig(25));
  expect(parseScrapeRules(1, rules)).toEqual(rules);
  expect(() =>
    parseScrapeRules(1, {
      ...rules,
      list: { ...rules.list, item: ".card" },
    }),
  ).toThrow();
  expect(SCRAPE_RULES_VERSION).toBe(8);
});

test("adds catalog rules only in version 7", () => {
  const field = (selector: string) => ({
    try: [
      {
        get: "text" as const,
        selector,
        take: "first" as const,
        startsWith: null,
        clean: null,
      },
    ],
  });
  const rules = ScrapeRulesV7Schema.parse({
    kind: "catalog",
    products: {
      oneProductPer: "article.product",
      link: "a[href]",
      skipWhen: null,
      nextPage: null,
      limit: 25,
    },
    product: {
      name: field("h1"),
      url: null,
      externalProductId: null,
      imageUrl: null,
      volume: field(".volume"),
      abv: field(".abv"),
      statedAge: null,
      edition: null,
      releaseYear: null,
    },
  });

  expect(parseScrapeRules(7, rules)).toEqual(rules);
  expect(() => ScrapeRulesV6Schema.parse(rules)).toThrow();
  expect(() => parseScrapeRules(6, rules)).toThrow();
});

test("changes text matching only in version 8", () => {
  const version8 = ScrapeRulesSchema.parse({
    kind: "price",
    products: {
      oneProductPer: "article.product",
      link: "a[href]",
      skipWhen: null,
      nextPage: null,
      limit: 25,
    },
    product: {
      name: {
        try: [
          {
            get: "text",
            selector: "h1",
            take: "first",
            match: ["{value}{line}{anything}"],
            addStart: null,
            addEnd: null,
          },
        ],
      },
      price: {
        try: [
          {
            get: "text",
            selector: ".price",
            take: "first",
            match: ["Price: {value}"],
            addStart: null,
            addEnd: null,
          },
        ],
      },
      currency: "usd",
      volume: {
        try: [
          {
            get: "fixed",
            value: "750 ml",
            addStart: null,
            addEnd: null,
          },
        ],
      },
      url: null,
      externalProductId: null,
      imageUrl: null,
      barcode: null,
    },
  });

  expect(parseScrapeRules(8, version8)).toEqual(version8);
  expect(() => parseScrapeRules(7, version8)).toThrow();
  if (version8.kind !== "price") throw new Error("Expected price rules.");

  const version7 = ScrapeRulesV7Schema.parse({
    ...version8,
    product: {
      ...version8.product,
      name: {
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
      price: {
        try: [
          {
            get: "text",
            selector: ".price",
            take: "first",
            startsWith: null,
            clean: null,
          },
        ],
      },
      volume: {
        try: [{ get: "fixed", value: "750 ml", clean: null }],
      },
    },
  });
  expect(parseScrapeRules(7, version7)).toEqual(version7);
  expect(() => parseScrapeRules(8, version7)).toThrow();
});

test("loads version 2 rules only through their original contract", () => {
  const rules = ScrapeRulesV2Schema.parse(reviewConfig(25));
  expect(parseScrapeRules(2, rules)).toEqual(rules);
  expect(() =>
    parseScrapeRules(2, {
      ...rules,
      detail: {
        ...rules.detail,
        canonicalUrl: {
          selector: 'link[rel="canonical"]',
          attribute: "href",
        },
      },
    }),
  ).toThrow();
});

test("loads version 4 rules only through their original contract", () => {
  const rules = ScrapeRulesV4Schema.parse({
    ...reviewConfig(25),
    detail: {
      ...reviewConfig(25).detail,
      canonicalUrl: {
        selector: 'link[rel="canonical"]',
        attribute: "href",
        removeSuffixes: ["/"],
      },
      publishedAt: { urlDateFormat: "/yyyy/MM/*-MMddyy" },
      score: {
        value: { selector: ".rating", removePrefixes: ["Rating:"] },
        scale: 100,
        map: [
          { text: "A", value: 95 },
          { text: "B+", value: 87 },
        ],
      },
    },
  });

  expect(parseScrapeRules(4, rules)).toEqual(rules);
  expect(() =>
    parseScrapeRules(4, {
      ...rules,
      detail: {
        ...rules.detail,
        score: {
          value: { selector: ".rating", removePrefixes: ["Rating:"] },
          scale: 100,
          map: [
            { text: "A", value: 95 },
            { text: "B+", value: 87 },
          ],
          firstReviewFallback: { selector: ".article-rating" },
        },
      },
    }),
  ).toThrow();
});

test("loads version 3 rules only through their original contract", () => {
  const rules = ScrapeRulesV3Schema.parse(reviewConfig(25));
  expect(parseScrapeRules(3, rules)).toEqual(rules);
  expect(() =>
    parseScrapeRules(3, {
      ...rules,
      detail: {
        ...rules.detail,
        reviewItem: { start: "h2.review" },
      },
    }),
  ).toThrow();
});

test("accepts review sections with an end selector", () => {
  const config = reviewConfig(25);
  const rules = ScrapeRulesV5Schema.parse({
    ...config,
    detail: {
      ...config.detail,
      reviewItem: {
        start: ".entry-content > h2.review",
        endBefore: ".entry-content > .related-posts",
      },
    },
  });

  expect(parseScrapeRules(5, rules)).toMatchObject({
    kind: "review",
    detail: {
      reviewItem: {
        start: ".entry-content > h2.review",
        endBefore: ".entry-content > .related-posts",
      },
    },
  });
});

test("accepts a separate first-review score", () => {
  const config = reviewConfig(25);
  const rules = ScrapeRulesV5Schema.parse({
    ...config,
    detail: {
      ...config.detail,
      score: {
        value: { selector: ".review-score" },
        firstReviewFallback: { selector: ".article-score" },
        scale: 100,
      },
    },
  });

  expect(parseScrapeRules(5, rules)).toEqual(rules);
});

test.each([
  ["missing URL year", "/reviews/MM/dd/*"],
  ["missing URL month", "/reviews/yyyy/dd/*"],
  ["missing URL day", "/reviews/yyyy/MM/*"],
  ["unknown URL token", "/reviews/yyyy/MM/DD/*"],
])("rejects invalid URL date formats: %s", (_, urlDateFormat) => {
  expect(() =>
    ScrapeRulesV5Schema.parse({
      ...reviewConfig(25),
      detail: {
        ...reviewConfig(25).detail,
        publishedAt: { urlDateFormat },
      },
    }),
  ).toThrow();
});

test("rejects duplicate or out-of-range score mappings", () => {
  const config = reviewConfig(25);
  expect(() =>
    ScrapeRulesV5Schema.parse({
      ...config,
      detail: {
        ...config.detail,
        score: {
          value: { selector: ".rating" },
          scale: 10,
          map: [
            { text: "A", value: 9 },
            { text: "a", value: 11 },
          ],
        },
      },
    }),
  ).toThrow();
});

test("accepts bounded list-card exclusion only with an item selector", () => {
  expect(
    ScrapeRulesV5Schema.parse({
      ...reviewConfig(25),
      list: {
        ...reviewConfig(25).list,
        item: ".product-card",
        excludeWhen: { selector: ".badge", startsWith: ["Sold out"] },
      },
    }).list,
  ).toMatchObject({
    item: ".product-card",
    excludeWhen: { selector: ".badge", startsWith: ["Sold out"] },
  });
  expect(() =>
    ScrapeRulesV5Schema.parse({
      ...reviewConfig(25),
      list: {
        ...reviewConfig(25).list,
        excludeWhen: { selector: ".badge" },
      },
    }),
  ).toThrow("List exclusion requires an item selector.");
});

test("accepts bounded selector and fixed value operations", () => {
  expect(
    ScrapeValueSchema.parse({
      selector: ".notes p",
      startsWith: ["Nose:", "Finish:"],
      all: true,
      removePrefixes: ["Score:"],
      removeSuffixes: [" Review"],
      prefix: "Kilchoman ",
      suffix: "/100",
    }),
  ).toEqual({
    selector: ".notes p",
    startsWith: ["Nose:", "Finish:"],
    all: true,
    removePrefixes: ["Score:"],
    removeSuffixes: ["Review"],
    prefix: "Kilchoman ",
    suffix: "/100",
  });
  expect(ScrapeValueSchema.parse({ value: "700 ml" })).toEqual({
    value: "700 ml",
  });
});

test.each([
  ["both inputs", { selector: "h1", value: "700 ml" }],
  ["no input", { prefix: "Kilchoman " }],
  ["unknown operation", { selector: "h1", regex: "Review$" }],
  [
    "attribute prefix filter",
    { selector: "meta", attribute: "content", startsWith: ["Score"] },
  ],
  ["attribute joining", { selector: "meta", attribute: "content", all: true }],
  ["fixed value length", { value: "x".repeat(201) }],
  ["prefix length", { selector: "h1", prefix: "x".repeat(201) }],
  ["suffix length", { selector: "h1", suffix: "x".repeat(201) }],
  [
    "prefix count",
    { selector: "p", startsWith: Array.from({ length: 11 }, () => "Nose") },
  ],
  ["prefix length", { selector: "p", startsWith: ["x".repeat(101)] }],
  [
    "suffix count",
    {
      selector: "h1",
      removeSuffixes: Array.from({ length: 11 }, () => "Review"),
    },
  ],
  ["suffix length", { selector: "h1", removeSuffixes: ["x".repeat(101)] }],
  [
    "removed prefix count",
    {
      selector: "h1",
      removePrefixes: Array.from({ length: 11 }, () => "Score"),
    },
  ],
  [
    "removed prefix length",
    { selector: "h1", removePrefixes: ["x".repeat(101)] },
  ],
])("rejects invalid or unbounded value rules: %s", (_, rule) => {
  expect(() => ScrapeValueSchema.parse(rule)).toThrow();
});
