import { expect, test } from "vitest";
import {
  matchFirstText,
  matchText,
  ScrapeTextTemplateSchema,
} from "./textTemplate";

test("matches fixed text without changing its spelling", () => {
  expect(matchText("  Latest   Reviews ", "latest reviews")).toBe(
    "Latest Reviews",
  );
});

test("extracts one value while ignoring changing text", () => {
  expect(
    matchText("Review 2/4 - Broddy Balfour", "Review {anything} - {value}"),
  ).toBe("Broddy Balfour");
  expect(matchText("Score: 7.5 / 10", "Score: {value} / 10")).toBe("7.5");
  expect(
    matchText("Glen Example 12 Year\n£85", "{value}{line}{anything}"),
  ).toBe("Glen Example 12 Year");
});

test("ignores formatting spaces around a line break", () => {
  expect(
    matchText("Glen Example 12 Year\n£85", "{value} {line} {anything}"),
  ).toBe("Glen Example 12 Year");
});

test("tries alternative matches in order", () => {
  expect(matchFirstText("Review", ["Review {anything}", "Review"])).toBe(
    "Review",
  );
  expect(
    matchFirstText("Introduction", ["Review", "Review {anything}"]),
  ).toBeNull();
});

test("bounds the template language", () => {
  expect(() => ScrapeTextTemplateSchema.parse("{value}")).toThrow();
  expect(() => ScrapeTextTemplateSchema.parse("Review {writer}")).toThrow();
  expect(() => ScrapeTextTemplateSchema.parse("{value} and {value}")).toThrow();
});
