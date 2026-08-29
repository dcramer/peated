import { expect, test } from "vitest";
import {
  parseScrapeRules,
  SCRAPE_SOURCE_MAX_ITEMS,
  SCRAPE_SOURCE_MAX_LIST_PAGES,
  ScrapeRulesSchema,
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
  expect(() => parseScrapeRules(2, rules)).toThrow(
    "Unsupported scrape rules version: 2.",
  );
});
