import { expect, test } from "vitest";
import {
  parseScrapeRules,
  SCRAPE_SOURCE_MAX_ITEMS,
  ScrapeRulesSchema,
} from "./config";

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

test("keeps the list and every detail page within one run", () => {
  expect(
    ScrapeRulesSchema.parse(reviewConfig(SCRAPE_SOURCE_MAX_ITEMS)).list
      .maxItems,
  ).toBe(99);
  expect(() =>
    ScrapeRulesSchema.parse(reviewConfig(SCRAPE_SOURCE_MAX_ITEMS + 1)),
  ).toThrow();
});

test("rejects rules for an unsupported stored format", () => {
  const rules = ScrapeRulesSchema.parse(reviewConfig(25));
  expect(() => parseScrapeRules(2, rules)).toThrow(
    "Unsupported scrape rules format: 2.",
  );
});
