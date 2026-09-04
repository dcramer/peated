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
  expect(
    ScrapeRulesSchema.parse(reviewConfig(SCRAPE_SOURCE_MAX_ITEMS)).list
      .maxItems,
  ).toBe(99);
  expect(() =>
    ScrapeRulesSchema.parse(reviewConfig(SCRAPE_SOURCE_MAX_ITEMS + 1)),
  ).toThrow();
  expect(SCRAPE_SOURCE_MAX_LIST_PAGES).toBe(5);
});

test("rejects rules for an unsupported stored format", () => {
  const rules = ScrapeRulesSchema.parse(reviewConfig(25));
  expect(() => parseScrapeRules(5, rules)).toThrow(
    "Unsupported scrape rules version: 5.",
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
  expect(SCRAPE_RULES_VERSION).toBe(4);
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

test("accepts bounded canonical URLs, URL dates, and score maps", () => {
  const rules = ScrapeRulesSchema.parse({
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
  const rules = ScrapeRulesSchema.parse({
    ...config,
    detail: {
      ...config.detail,
      reviewItem: {
        start: ".entry-content > h2.review",
        endBefore: ".entry-content > .related-posts",
      },
    },
  });

  expect(parseScrapeRules(4, rules)).toMatchObject({
    kind: "review",
    detail: {
      reviewItem: {
        start: ".entry-content > h2.review",
        endBefore: ".entry-content > .related-posts",
      },
    },
  });
});

test.each([
  ["missing URL year", "/reviews/MM/dd/*"],
  ["missing URL month", "/reviews/yyyy/dd/*"],
  ["missing URL day", "/reviews/yyyy/MM/*"],
  ["unknown URL token", "/reviews/yyyy/MM/DD/*"],
])("rejects invalid URL date formats: %s", (_, urlDateFormat) => {
  expect(() =>
    ScrapeRulesSchema.parse({
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
    ScrapeRulesSchema.parse({
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
    ScrapeRulesSchema.parse({
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
    ScrapeRulesSchema.parse({
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
