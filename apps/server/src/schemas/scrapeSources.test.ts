import { expect, test } from "vitest";
import { ScrapeSourceCreateSchema } from "./scrapeSources";

const source = {
  key: "example-reviews",
  name: "Example Reviews",
  kind: "review" as const,
  listUrl: "https://reviews.example/archive",
};

test("accepts only HTTP website URLs", () => {
  expect(ScrapeSourceCreateSchema.parse(source).listUrl).toBe(source.listUrl);
  expect(() =>
    ScrapeSourceCreateSchema.parse({
      ...source,
      listUrl: "ftp://reviews.example/archive",
    }),
  ).toThrow("URL must use HTTP or HTTPS.");
});
