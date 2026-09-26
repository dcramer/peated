import { describe, expect, test } from "vitest";
import type { BottleExtractedDetails } from "./classifierTypes";
import {
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

  test("allows ABV rounding below a tenth", () => {
    expect(getBottleFieldConflicts({ ...facts, abv: 46.04 }, bottle)).toEqual(
      [],
    );
    expect(getBottleFieldConflicts({ ...facts, abv: 46.2 }, bottle)).toEqual([
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
});
