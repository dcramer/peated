import { expect, it } from "vitest";
import {
  applyDetailPageUrlCompatibility,
  readCompatiblePublishedDate,
  readCompatiblePublishedDateValue,
} from "./sourceCompatibility";

it("adds the GlenAllachie UK storefront parameter to product URLs", () => {
  expect(
    applyDetailPageUrlCompatibility(
      new URL("https://shop.theglenallachie.com/products/example"),
    ).toString(),
  ).toBe("https://shop.theglenallachie.com/products/example?country=GB");
  expect(
    applyDetailPageUrlCompatibility(
      new URL("https://shop.theglenallachie.com/collections/example"),
    ).toString(),
  ).toBe("https://shop.theglenallachie.com/collections/example");
});

it("reads Whiskyfun's compact article date", () => {
  expect(
    readCompatiblePublishedDate(
      new URL("https://www.whiskyfun.com/2026/example-article-090826.html"),
    ),
  ).toEqual(new Date("2026-09-08T00:00:00.000Z"));
  expect(
    readCompatiblePublishedDate(
      new URL("https://example.test/2026/example-article-090826.html"),
    ),
  ).toBeNull();
  expect(
    readCompatiblePublishedDateValue(
      "090926",
      new URL("https://www.whiskyfun.com/2026/example-article.html"),
    ),
  ).toEqual(new Date("2026-09-09T00:00:00.000Z"));
  expect(
    readCompatiblePublishedDateValue(
      "090926",
      new URL("https://example.test/2026/example-article.html"),
    ),
  ).toBeNull();
});
