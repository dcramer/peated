import { describe, expect, it } from "vitest";

import { getBottleMetadata, getBottleReviewMetadata } from "./bottleMetadata";

describe("bottle metadata", () => {
  it("spells out a missing age statement", () => {
    expect(
      getBottleMetadata({
        abv: 43,
        category: "single_malt",
        edition: null,
        noAgeStatement: true,
        releaseYear: null,
        statedAge: null,
        vintageYear: null,
      }),
    ).toBe("Single Malt · No age statement · 43% ABV");
  });

  it("uses one supporting release fact", () => {
    expect(
      getBottleReviewMetadata({
        abv: 52.4,
        edition: null,
        releaseYear: 2026,
        statedAge: 36,
        vintageYear: 1989,
      }),
    ).toEqual(["36 years", "52.4% ABV", "1989 vintage"]);
  });

  it("shows a numbered batch as release metadata", () => {
    expect(
      getBottleReviewMetadata({
        abv: 68.3,
        edition: "Batch C923",
        releaseYear: 2023,
        statedAge: 12,
        vintageYear: null,
      }),
    ).toEqual(["12 years", "68.3% ABV", "Batch C923"]);

    expect(
      getBottleMetadata({
        abv: 68.3,
        category: "bourbon",
        edition: "Batch C923",
        noAgeStatement: false,
        releaseYear: 2023,
        statedAge: 12,
        vintageYear: null,
      }),
    ).toBe("Batch C923 · Bourbon · 12 years · 68.3% ABV");
  });

  it("omits missing facts and unnecessary ABV decimals", () => {
    expect(
      getBottleReviewMetadata({
        abv: 43,
        edition: null,
        releaseYear: null,
        statedAge: null,
        vintageYear: null,
      }),
    ).toEqual(["43% ABV"]);
  });
});
