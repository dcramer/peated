import { expect, test } from "vitest";
import {
  SCRAPE_SOURCE_MAX_MODEL_INPUT_CHARS,
  createScrapeRulesSuggestionFormat,
  prepareScrapeSourceModelPages,
} from "./generator";

test("uses object schemas for AI output", () => {
  for (const kind of ["review", "price"] as const) {
    const format = createScrapeRulesSuggestionFormat(kind);
    expect(format.schema).toMatchObject({ type: "object" });
    expect(JSON.stringify(format.schema)).not.toContain('"oneOf"');
  }
});

test("bounds total AI input while keeping every sample page", () => {
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
