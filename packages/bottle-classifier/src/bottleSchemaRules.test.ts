import { describe, expect, test } from "vitest";

import {
  bottleMarketsStatedAge,
  formatCanonicalReleaseName,
  getResolvedReleaseIdentity,
  hasBottleLevelReleaseTraits,
  hasDirtyBottleLevelStatedAgeConflict,
  hasExtractedReleaseIdentity,
} from "./bottleSchemaRules";

describe("bottleSchemaRules", () => {
  test("detects bottle-level release traits", () => {
    expect(
      hasBottleLevelReleaseTraits({
        edition: null,
        releaseYear: null,
        vintageYear: null,
        abv: null,
        singleCask: null,
        caskStrength: null,
        caskFill: null,
        caskType: null,
        caskSize: null,
      }),
    ).toBe(false);

    expect(
      hasBottleLevelReleaseTraits({
        edition: "Batch 24",
      }),
    ).toBe(true);
  });

  test("tracks when the bottle itself markets its stated age", () => {
    expect(
      bottleMarketsStatedAge({
        name: "Lagavulin 16",
        fullName: "Lagavulin 16-year-old",
        statedAge: 16,
      }),
    ).toBe(true);

    expect(
      bottleMarketsStatedAge({
        name: "Private Selection",
        fullName: "Maker's Mark Private Selection",
        statedAge: 10,
      }),
    ).toBe(false);
  });

  test("flags dirty parent age conflicts only when the parent does not market that age", () => {
    expect(
      hasDirtyBottleLevelStatedAgeConflict({
        bottle: {
          name: "Private Selection",
          fullName: "Maker's Mark Private Selection",
          statedAge: 10,
        },
        releaseStatedAge: 12,
      }),
    ).toBe(true);

    expect(
      hasDirtyBottleLevelStatedAgeConflict({
        bottle: {
          name: "Lagavulin 16",
          fullName: "Lagavulin 16-year-old",
          statedAge: 16,
        },
        releaseStatedAge: 12,
      }),
    ).toBe(false);
  });

  test("resolves release identity and canonical naming without duplicating parent age", () => {
    const resolved = getResolvedReleaseIdentity({
      bottle: {
        name: "Lagavulin Distillers Edition",
        fullName: "Lagavulin Distillers Edition",
        statedAge: 16,
      },
      release: {
        edition: null,
        statedAge: 16,
        releaseYear: 2011,
        vintageYear: null,
        abv: 43,
        singleCask: null,
        caskStrength: null,
        caskFill: null,
        caskType: null,
        caskSize: null,
      },
    });

    expect(resolved.statedAge).toBe(16);
    expect(
      formatCanonicalReleaseName({
        bottleName: "Lagavulin Distillers Edition",
        bottleFullName: "Lagavulin Distillers Edition",
        bottleStatedAge: 16,
        release: resolved,
      }),
    ).toEqual({
      name: "Lagavulin Distillers Edition - 2011 Release - 43.0% ABV",
      fullName: "Lagavulin Distillers Edition - 2011 Release - 43.0% ABV",
    });
  });

  test("detects extracted release identity from structured classifier output", () => {
    expect(
      hasExtractedReleaseIdentity({
        edition: null,
        stated_age: null,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        cask_strength: null,
        single_cask: null,
      }),
    ).toBe(false);

    expect(
      hasExtractedReleaseIdentity({
        edition: "Batch 24",
        stated_age: null,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        cask_strength: null,
        single_cask: null,
      }),
    ).toBe(true);
  });
});
