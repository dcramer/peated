import { describe, expect, it } from "vitest";

import { getBottleMetadata, getBottleReviewMetadata } from "./bottleMetadata";

describe("bottle metadata", () => {
  it("spells out a missing age statement", () => {
    expect(
      getBottleMetadata({
        abv: 43,
        category: "single_malt",
        noAgeStatement: true,
        statedAge: null,
      }),
    ).toBe("Single Malt · No age statement · 43% ABV");
  });

  it("keeps reviewed release facts out of the bottle name", () => {
    expect(
      getBottleReviewMetadata({
        abv: 52.4,
        releaseYear: 2026,
        statedAge: 36,
        vintageYear: 1989,
      }),
    ).toEqual(["36 years", "52.4% ABV", "1989 vintage", "2026 release"]);
  });

  it("omits missing facts and unnecessary ABV decimals", () => {
    expect(
      getBottleReviewMetadata({
        abv: 43,
        releaseYear: null,
        statedAge: null,
        vintageYear: null,
      }),
    ).toEqual(["43% ABV"]);
  });
});
