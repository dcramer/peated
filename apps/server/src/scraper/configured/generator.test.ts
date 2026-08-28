import { expect, test } from "vitest";
import {
  SCRAPE_SOURCE_MAX_MODEL_INPUT_CHARS,
  prepareScrapeSourceModelPages,
} from "./generator";

test("bounds total model input while keeping every sample page", () => {
  const pages = Array.from({ length: 10 }, (_, index) => ({
    url: `https://example.test/${index}`,
    html: "x".repeat(50_000),
  }));
  const prepared = prepareScrapeSourceModelPages(pages);

  expect(prepared).toHaveLength(pages.length);
  expect(prepared.every((page) => page.html.length > 0)).toBe(true);
  expect(
    prepared.reduce((total, page) => total + page.html.length, 0),
  ).toBeLessThanOrEqual(SCRAPE_SOURCE_MAX_MODEL_INPUT_CHARS);
});
