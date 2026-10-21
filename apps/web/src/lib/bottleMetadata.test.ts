import { describe, expect, it } from "vitest";

import {
  getBottleHeaderSpecs,
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

  const headerBottle = {
    abv: null,
    bottlingYear: null,
    caskNumber: null,
    category: null,
    edition: null,
    noAgeStatement: null,
    releaseYear: null,
    statedAge: null,
    vintageYear: null,
  };

  it("leads header specs with ABV and skips an age the name prints", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, abv: 52, category: "single_malt", statedAge: 12 },
        "12-year-old",
      ),
    ).toEqual([
      { label: "ABV", value: "52%" },
      { label: "Category", value: "Single Malt" },
    ]);
  });

  it("keeps the three facts that best identify the release", () => {
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 68.3,
          bottlingYear: 2023,
          category: "bourbon",
          edition: "Batch C923",
          statedAge: 12,
        },
        "Elijah Craig Barrel Proof",
      ),
    ).toEqual([
      { label: "ABV", value: "68.3%" },
      { label: "Batch", value: "C923" },
      { label: "Age", value: "12 years" },
    ]);
  });

  it("shows a cask number and one year, preferring vintage", () => {
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 48.2,
          bottlingYear: 2003,
          caskNumber: "1234",
          noAgeStatement: true,
          vintageYear: 1985,
        },
        "Single Cask",
      ),
    ).toEqual([
      { label: "ABV", value: "48.2%" },
      { label: "Cask", value: "1234" },
      { label: "Age", value: "NAS" },
    ]);
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, bottlingYear: 1988, vintageYear: 1975 },
        "Old Bottling",
      ),
    ).toEqual([{ label: "Vintage", value: "1975" }]);
  });

  it("skips a year the name already prints", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, abv: 43, bottlingYear: 2003, vintageYear: 1968 },
        "1968 35-year-old",
      ),
    ).toEqual([{ label: "ABV", value: "43%" }]);
  });

  it("skips a cask number only when the name prints it as a cask", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "12", statedAge: 12 },
        "12-year-old",
      ),
    ).toEqual([{ label: "Cask", value: "12" }]);
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "1841", statedAge: 7 },
        "Single Cask 2014 No.1841 7-year-old",
      ),
    ).toBeNull();
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "84" },
        "1984 Cask #84",
      ),
    ).toBeNull();
  });

  it("falls back to the cask number when the name prints the batch", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "77", edition: "Batch 3" },
        "Single Cask Batch 3",
      ),
    ).toEqual([{ label: "Cask", value: "77" }]);
  });

  it("matches a printed year only as a whole number", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, vintageYear: 1984 },
        "Cask 19841",
      ),
    ).toEqual([{ label: "Vintage", value: "1984" }]);
  });

  it("returns nothing when no facts are known", () => {
    expect(getBottleHeaderSpecs(headerBottle, "Uigeadail")).toBeNull();
  });
});
