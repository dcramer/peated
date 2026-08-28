import { expect, test } from "vitest";
import {
  CONFIGURED_SCRAPER_MAX_ITEMS,
  ConfiguredScraperConfigSchema,
} from "./config";

function reviewConfig(maxItems: number) {
  return {
    engineVersion: 1,
    collection: "reviews",
    index: {
      itemLink: { selector: "a.review", attribute: "href" },
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
    ConfiguredScraperConfigSchema.parse(
      reviewConfig(CONFIGURED_SCRAPER_MAX_ITEMS),
    ).index.maxItems,
  ).toBe(99);
  expect(() =>
    ConfiguredScraperConfigSchema.parse(
      reviewConfig(CONFIGURED_SCRAPER_MAX_ITEMS + 1),
    ),
  ).toThrow();
});
