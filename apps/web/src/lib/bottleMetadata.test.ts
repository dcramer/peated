import { describe, expect, it } from "vitest";

import { getBottleHeaderSpecs } from "./bottleMetadata";

describe("bottle metadata", () => {
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

  it("shows a selection edition after cask and age", () => {
    const selectedCask = {
      ...headerBottle,
      abv: 58.9,
      bottlingYear: 2010,
      caskNumber: "14300",
      category: "single_malt" as const,
      edition: "for La Maison du Whisky",
      statedAge: 37,
      vintageYear: 1972,
    };

    expect(getBottleHeaderSpecs(selectedCask, "Clynelish 1972")).toEqual([
      { label: "ABV", value: "58.9%" },
      { label: "Cask", value: "14300" },
      { label: "Age", value: "37 years" },
    ]);
    expect(
      getBottleHeaderSpecs(
        { ...selectedCask, caskNumber: null, statedAge: null },
        "Clynelish 1972",
      ),
    ).toEqual([
      { label: "ABV", value: "58.9%" },
      { label: "Edition", value: "for La Maison du Whisky" },
      { label: "Category", value: "Single Malt" },
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

  it("moves a year or cask the name prints behind the other facts", () => {
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 43,
          category: "single_malt",
          statedAge: 35,
          vintageYear: 1968,
        },
        "1968 35-year-old",
      ),
    ).toEqual([
      { label: "ABV", value: "43%" },
      { label: "Category", value: "Single Malt" },
      { label: "Vintage", value: "1968" },
    ]);
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 56.1,
          caskNumber: "#1841",
          category: "single_malt",
          noAgeStatement: true,
          vintageYear: 2014,
        },
        "Single Cask 2014 No.1841",
      ),
    ).toEqual([
      { label: "ABV", value: "56.1%" },
      { label: "Age", value: "NAS" },
      { label: "Category", value: "Single Malt" },
    ]);
  });

  it("strips a cask marker only before a number", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "Nordic 5", category: "rye" },
        "Rdic 5",
      ),
    ).toEqual([
      { label: "Cask", value: "Nordic 5" },
      { label: "Category", value: "Rye" },
    ]);
  });

  it("matches the name by whole words only", () => {
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "12", vintageYear: 1984 },
        "Cask 120 19841",
      ),
    ).toEqual([
      { label: "Cask", value: "12" },
      { label: "Vintage", value: "1984" },
    ]);
  });

  it("returns nothing when no facts are known", () => {
    expect(getBottleHeaderSpecs(headerBottle, "Uigeadail")).toBeNull();
  });
});
