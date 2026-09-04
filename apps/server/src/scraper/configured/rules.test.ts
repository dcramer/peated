import { expect, test } from "vitest";
import {
  parseScrapeRules,
  SCRAPE_RULES_VERSION,
  SCRAPE_SOURCE_MAX_ITEMS,
  SCRAPE_SOURCE_MAX_LIST_PAGES,
  ScrapeRulesSchema,
  ScrapeRulesV1Schema,
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
  expect(() => parseScrapeRules(3, rules)).toThrow(
    "Unsupported scrape rules version: 3.",
  );
});

test("loads old rules only through the version 1 contract", () => {
  const rules = ScrapeRulesV1Schema.parse(reviewConfig(25));
  expect(parseScrapeRules(1, rules)).toEqual(rules);
  expect(SCRAPE_RULES_VERSION).toBe(2);
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
