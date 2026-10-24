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
    series: null,
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

  it("leads with the series, then ABV and age ahead of a cask", () => {
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 58.9,
          bottlingYear: 2010,
          caskNumber: "14300",
          category: "single_malt",
          series: { name: "The Dram Takers" },
          statedAge: 37,
          vintageYear: 1972,
        },
        "Clynelish 1972",
      ),
    ).toEqual([
      { label: "Series", value: "The Dram Takers", text: true },
      { label: "ABV", value: "58.9%" },
      { label: "Age", value: "37 years" },
    ]);
  });

  it("leaves out a series or ABV the name prints", () => {
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 59.5,
          category: "single_malt",
          series: { name: "Exploration Series" },
          statedAge: 10,
        },
        "Exploration Series No. 1 59.5%",
      ),
    ).toEqual([
      { label: "Age", value: "10 years" },
      { label: "Category", value: "Single Malt" },
    ]);
  });

  it("puts a year ahead of a batch or cask", () => {
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
        "Barrel Proof",
      ),
    ).toEqual([
      { label: "ABV", value: "68.3%" },
      { label: "Age", value: "12 years" },
      { label: "Bottled", value: "2023" },
    ]);
    expect(
      getBottleHeaderSpecs(
        {
          ...headerBottle,
          abv: 68.3,
          category: "bourbon",
          edition: "Batch C923",
        },
        "Barrel Proof",
      ),
    ).toEqual([
      { label: "ABV", value: "68.3%" },
      { label: "Batch", value: "C923" },
      { label: "Category", value: "Bourbon" },
    ]);
  });

  it("shows a selection edition after age and ahead of a cask", () => {
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
      { label: "Age", value: "37 years" },
      { label: "Edition", value: "for La Maison du Whisky", text: true },
    ]);
    expect(
      getBottleHeaderSpecs(
        { ...selectedCask, caskNumber: null, statedAge: null },
        "Clynelish 1972",
      ),
    ).toEqual([
      { label: "ABV", value: "58.9%" },
      { label: "Edition", value: "for La Maison du Whisky", text: true },
      { label: "Category", value: "Single Malt" },
    ]);
  });

  it("shows one year, preferring vintage, and a cask when a slot is free", () => {
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
      { label: "Age", value: "NAS" },
      { label: "Vintage", value: "1985" },
    ]);
    expect(
      getBottleHeaderSpecs(
        { ...headerBottle, caskNumber: "1234", vintageYear: 1975 },
        "Old Bottling",
      ),
    ).toEqual([
      { label: "Vintage", value: "1975" },
      { label: "Cask", value: "1234" },
    ]);
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
      { label: "Vintage", value: "1984" },
      { label: "Cask", value: "12" },
    ]);
  });

  it("returns nothing when no facts are known", () => {
    expect(getBottleHeaderSpecs(headerBottle, "Uigeadail")).toBeNull();
  });
});
