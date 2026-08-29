import { expect, test } from "vitest";
import { ScrapeSourceCreateSchema } from "./scrapeSources";

const source = {
  name: "Example Reviews",
  kind: "review" as const,
  websiteUrl: "https://reviews.example/",
};

test("accepts only HTTP website URLs", () => {
  expect(ScrapeSourceCreateSchema.parse(source).websiteUrl).toBe(
    source.websiteUrl,
  );
  expect(() =>
    ScrapeSourceCreateSchema.parse({
      ...source,
      websiteUrl: "ftp://reviews.example/",
    }),
  ).toThrow("URL must use HTTP or HTTPS.");
});

test("does not expose an AI opt-out", () => {
  expect(() =>
    ScrapeSourceCreateSchema.parse({
      ...source,
      allowAiSuggestions: false,
    }),
  ).toThrow();
});
