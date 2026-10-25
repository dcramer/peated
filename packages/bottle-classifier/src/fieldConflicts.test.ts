import { describe, expect, test } from "vitest";
import type { BottleExtractedDetails } from "./classifierTypes";
import {
  compareBottleFields,
  getBottleFieldConflicts,
  type ComparableBottleFields,
} from "./fieldConflicts";

const facts: BottleExtractedDetails = {
  brand: "Example",
  bottler: null,
  expression: "Port Cask",
  series: null,
  distillery: [],
  category: "single_malt",
  stated_age: 10,
  abv: 46,
  release_year: null,
  vintage_year: null,
  cask_strength: null,
  single_cask: null,
  maturation: null,
  cask_number: null,
  outturn: null,
  edition: "Batch No. 3",
};

const bottle: ComparableBottleFields = {
  category: "single_malt",
  statedAge: 10,
  abv: 46,
  vintageYear: 2012,
  releaseYear: null,
  caskStrength: true,
  singleCask: null,
  edition: "Batch 3",
};

function editionConflicts(source: string, stored: string) {
  return getBottleFieldConflicts(
    { ...facts, edition: source },
    { ...bottle, edition: stored },
  );
}

describe("getBottleFieldConflicts", () => {
  test("finds no conflict when populated fields agree or one side is empty", () => {
    expect(getBottleFieldConflicts(facts, bottle)).toEqual([]);
  });

  test("reports each typed field that differs", () => {
    expect(
      getBottleFieldConflicts(
        { ...facts, stated_age: 12, category: "bourbon", edition: "Batch 4" },
        bottle,
      ),
    ).toEqual(["category", "statedAge", "edition"]);
  });

  test("counts any ABV difference", () => {
    expect(getBottleFieldConflicts({ ...facts, abv: 46.04 }, bottle)).toEqual([
      "abv",
    ]);
  });

  test("never compares free-text names", () => {
    expect(
      getBottleFieldConflicts(
        { ...facts, brand: "Another", expression: "Different" },
        bottle,
      ),
    ).toEqual([]);
  });

  test("has nothing to compare without facts", () => {
    expect(getBottleFieldConflicts(null, bottle)).toEqual([]);
  });

  test("reads a printed # or letter case as the same cask number", () => {
    const target = { ...bottle, caskNumber: "3771" };
    expect(
      getBottleFieldConflicts({ ...facts, cask_number: "#3771" }, target),
    ).toEqual([]);
    expect(
      getBottleFieldConflicts(
        { ...facts, cask_number: "r10/34" },
        { ...bottle, caskNumber: "R10/34" },
      ),
    ).toEqual([]);
    expect(
      getBottleFieldConflicts({ ...facts, cask_number: "#3773" }, target),
    ).toEqual(["caskNumber"]);
  });

  test("keeps other cask number punctuation", () => {
    expect(
      getBottleFieldConflicts(
        { ...facts, cask_number: "53322" },
        { ...bottle, caskNumber: "53.322" },
      ),
    ).toEqual(["caskNumber"]);
  });

  test("checks cask and date facts for every caller without inventing missing values", () => {
    const target = {
      ...bottle,
      caskNumber: "123",
      bottlingYear: 2020,
      releaseMonth: 9,
      releaseDay: 1,
    };
    expect(getBottleFieldConflicts(facts, target)).toEqual([]);
    expect(
      getBottleFieldConflicts(
        {
          ...facts,
          cask_number: "124",
          bottling_year: 2021,
          release_month: 10,
          release_day: 2,
        },
        target,
      ),
    ).toEqual(["caskNumber", "bottlingYear", "releaseMonth", "releaseDay"]);
    expect(
      getBottleFieldConflicts(
        { ...facts, cask_number: "123", bottling_year: 2020 },
        target,
      ),
    ).toEqual([]);
  });
});

describe("edition conflicts", () => {
  test("ignores wording around the same year", () => {
    // Auction lot 7551 against Bottle 3277, 2026-10-24.
    expect(editionConflicts("2017 Release", "2017 Edition")).toEqual([]);
    expect(editionConflicts("Release 2020", "2020 Edition")).toEqual([]);
  });

  test("ignores a marker that only one side records", () => {
    // Auction lot 4722 against Bottle 52158, 2026-10-24.
    expect(editionConflicts("Cask #2787", "Cask 2787 · Fèis Ìle 2023")).toEqual(
      [],
    );
    expect(
      editionConflicts("Batch 7", "Batch 7 · for The Whisky Shop"),
    ).toEqual([]);
  });

  test("reads accents, No., and leading zeros as the same marker", () => {
    expect(editionConflicts("Fèis Ìle 2023", "Feis Ile 2023")).toEqual([]);
    expect(editionConflicts("Edition No. 1", "Edition 01")).toEqual([]);
  });

  test("conflicts when each side has a different marker", () => {
    expect(editionConflicts("Batch 3", "Batch 4")).toEqual(["edition"]);
    expect(editionConflicts("S2B13", "S2B14")).toEqual(["edition"]);
    expect(editionConflicts("Fèis Ìle 2024", "Feis Ile 2023")).toEqual([
      "edition",
    ]);
  });

  test("keeps numbers joined by a dot or slash as one marker", () => {
    expect(editionConflicts("Batch 1.1", "Batch 1.2")).toEqual(["edition"]);
    expect(editionConflicts("Batch 1", "Batch 1.1")).toEqual(["edition"]);
    expect(editionConflicts("Batch 22/030", "Batch 22")).toEqual(["edition"]);
    expect(editionConflicts("Batch 1.2a", "Batch 1.2b")).toEqual(["edition"]);
    expect(editionConflicts("22/030A", "22/030")).toEqual(["edition"]);
    expect(editionConflicts("Release 02.1", "2.1")).toEqual([]);
    expect(
      compareBottleFields({ edition: "Batch 1" }, { edition: "Batch 1.1" }),
    ).toMatchObject({ agreements: [] });
  });

  test("leaves wording without markers to the classifier", () => {
    expect(editionConflicts("First Edition", "Limited Edition")).toEqual([]);
  });
});

describe("compareBottleFields", () => {
  test("sorts supplied facts into agreements, missing facts, and conflicts", () => {
    expect(
      compareBottleFields(
        { abv: 46, releaseYear: 2024, vintageYear: 2011, edition: "Batch 3" },
        bottle,
      ),
    ).toEqual({
      agreements: ["abv", "edition"],
      missing: ["releaseYear"],
      conflicts: ["vintageYear"],
    });
  });

  test("calls editions without matching markers neither agreement nor conflict", () => {
    expect(
      compareBottleFields(
        { edition: "First Edition" },
        { edition: "Limited Edition" },
      ),
    ).toEqual({ agreements: [], missing: [], conflicts: [] });
    expect(
      compareBottleFields(
        { edition: "Cask 2787" },
        { edition: "Cask 2787 2023" },
      ),
    ).toEqual({ agreements: [], missing: [], conflicts: [] });
  });
});
