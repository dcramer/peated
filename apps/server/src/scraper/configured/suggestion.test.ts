import { expect, test } from "vitest";
import {
  MAX_AI_INPUT_CHARS,
  createSuggestionFormat,
  prepareAiPages,
} from "./suggestion";

test("uses object schemas for AI output", () => {
  for (const kind of ["review", "price"] as const) {
    const format = createSuggestionFormat(kind);
    expect(format.schema).toMatchObject({ type: "object" });
    expect(JSON.stringify(format.schema)).not.toContain('"oneOf"');
  }
});

test("bounds total AI input while keeping every sample page", () => {
  const pages = Array.from({ length: 10 }, (_, index) => ({
    url: `https://example.test/${index}`,
    html: "x".repeat(50_000),
  }));
  const prepared = prepareAiPages(pages);

  expect(prepared).toHaveLength(pages.length);
  expect(prepared.every((page) => page.html.length > 0)).toBe(true);
  expect(
    prepared.reduce((total, page) => total + page.html.length, 0),
  ).toBeLessThanOrEqual(MAX_AI_INPUT_CHARS);
});
