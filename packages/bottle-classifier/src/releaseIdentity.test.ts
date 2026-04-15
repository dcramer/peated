import { describe, expect, test } from "vitest";

import {
  bottleMarketsStatedAge,
  doesStoreListingAliasIdentifyRelease,
  formatCanonicalReleaseName,
  getBottleLevelReleaseTraits,
  getCanonicalReleaseAliasNames,
  getReleaseObservationFacts,
  getResolvedReleaseIdentity,
  hasBlockingBottleLevelReleaseTraits,
  hasBottleLevelReleaseTraits,
  hasDirtyBottleLevelStatedAgeConflict,
  hasExtractedReleaseIdentity,
  isAddingBottleLevelReleaseTraits,
} from "./releaseIdentity";

describe("releaseIdentity", () => {
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

    expect(
      getBottleLevelReleaseTraits({
        edition: "Batch 24",
        releaseYear: null,
        abv: 58.4,
      }),
    ).toEqual({
      edition: "Batch 24",
      abv: 58.4,
    });
  });

  test("allows stable marketed parent traits, including hyphenated spellings, to be inherited by child releases", () => {
    expect(
      hasBlockingBottleLevelReleaseTraits({
        bottle: {
          name: "Glendronach 1972 Single Cask",
          fullName: "Glendronach 1972 Single Cask",
          statedAge: 48,
          singleCask: true,
        },
        release: {
          edition: "Batch 1",
          statedAge: 48,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          singleCask: true,
          caskStrength: null,
          caskFill: null,
          caskType: null,
          caskSize: null,
        },
      }),
    ).toBe(false);

    expect(
      hasBlockingBottleLevelReleaseTraits({
        bottle: {
          name: "Warehouse Single-Cask Archive",
          fullName: "Warehouse Single-Cask Archive",
          statedAge: 12,
          singleCask: true,
        },
        release: {
          edition: "Batch 1",
          statedAge: 12,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          singleCask: true,
          caskStrength: null,
          caskFill: null,
          caskType: null,
          caskSize: null,
        },
      }),
    ).toBe(false);

    expect(
      hasBlockingBottleLevelReleaseTraits({
        bottle: {
          name: "Warehouse Cask-Strength Archive",
          fullName: "Warehouse Cask-Strength Archive",
          statedAge: 12,
          caskStrength: true,
        },
        release: {
          edition: "Batch 1",
          statedAge: 12,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          singleCask: null,
          caskStrength: true,
          caskFill: null,
          caskType: null,
          caskSize: null,
        },
      }),
    ).toBe(false);

    expect(
      hasBlockingBottleLevelReleaseTraits({
        bottle: {
          name: "Warehouse Archive",
          fullName: "Warehouse Archive",
          statedAge: 48,
          singleCask: true,
        },
        release: {
          edition: "Batch 1",
          statedAge: 48,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          singleCask: true,
          caskStrength: null,
          caskFill: null,
          caskType: null,
          caskSize: null,
        },
      }),
    ).toBe(true);
  });

  test("returns only populated release observation facts", () => {
    expect(
      getReleaseObservationFacts({
        edition: "Batch C923",
        releaseYear: 2023,
        statedAge: null,
        abv: 62.4,
        caskStrength: true,
      }),
    ).toEqual({
      edition: "Batch C923",
      releaseYear: 2023,
      abv: 62.4,
      caskStrength: true,
    });
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

  test("does not duplicate inherited stable parent traits in release naming", () => {
    expect(
      formatCanonicalReleaseName({
        bottleName: "Glendronach 1972 Single Cask",
        bottleFullName: "Glendronach 1972 Single Cask",
        bottleReleaseTraits: {
          singleCask: true,
        },
        bottleStatedAge: 48,
        release: {
          edition: "Batch 1",
          statedAge: 48,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          singleCask: true,
          caskStrength: null,
          caskFill: null,
          caskType: null,
          caskSize: null,
        },
      }),
    ).toEqual({
      name: "Glendronach 1972 Single Cask - Batch 1",
      fullName: "Glendronach 1972 Single Cask - Batch 1",
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

  test("tracks when a write is adding bottle-level release traits", () => {
    expect(
      isAddingBottleLevelReleaseTraits({
        current: {
          edition: null,
          abv: null,
        },
        next: {
          edition: null,
          abv: null,
        },
      }),
    ).toBe(false);

    expect(
      isAddingBottleLevelReleaseTraits({
        current: {
          edition: null,
          abv: null,
        },
        next: {
          edition: "Batch 24",
          abv: null,
        },
      }),
    ).toBe(true);

    expect(
      isAddingBottleLevelReleaseTraits({
        current: {
          edition: "Batch 24",
          abv: 58.4,
        },
        next: {
          edition: "Batch 24",
          abv: 58.4,
        },
      }),
    ).toBe(false);
  });

  test("treats canonical release aliases as exact-name matches only", () => {
    expect(
      doesStoreListingAliasIdentifyRelease({
        aliasName: "Lagavulin Distillers Edition - 2011 Release",
        canonicalReleaseFullName: "Lagavulin Distillers Edition - 2011 Release",
      }),
    ).toBe(true);

    expect(
      doesStoreListingAliasIdentifyRelease({
        aliasName: "Lagavulin Distillers Edition",
        canonicalReleaseFullName: "Lagavulin Distillers Edition - 2011 Release",
      }),
    ).toBe(false);

    expect(
      getCanonicalReleaseAliasNames({
        fullName: "Lagavulin Distillers Edition - 2011 Release",
      }),
    ).toEqual(["Lagavulin Distillers Edition - 2011 Release"]);
  });
});
