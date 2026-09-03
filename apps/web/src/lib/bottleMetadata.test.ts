import { describe, expect, it } from "vitest";

import {
  getBottleReleasePlacement,
  getBottleReviewMetadata,
} from "./bottleMetadata";

describe("bottle metadata", () => {
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
  });

  it("places a release date once on the bottle page", () => {
    expect(
      getBottleReleasePlacement({
        edition: null,
        releaseYear: 2026,
        releaseMonth: 8,
        releaseDay: 30,
      }),
    ).toEqual({ header: "Aug 30, 2026", details: null });

    expect(
      getBottleReleasePlacement({
        edition: "Batch 24",
        releaseYear: 2026,
        releaseMonth: null,
        releaseDay: null,
      }),
    ).toEqual({ header: "Batch 24", details: "2026" });
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
