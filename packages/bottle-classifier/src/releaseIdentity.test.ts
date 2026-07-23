import { describe, expect, test } from "vitest";

import {
  bottleMarketsStatedAge,
  doesStoreListingAliasIdentifyRelease,
  formatCanonicalReleaseName,
  getBottleLevelReleaseTraits,
  getCanonicalReleaseAliasNames,
  getReleaseObservationFacts,
  getResolvedReleaseIdentity,
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

  test("does not duplicate exact age already marketed in the stable name", () => {
    expect(
      formatCanonicalReleaseName({
        bottleName: "Speyside 12-year-old",
        bottleFullName: "Shieldaig Speyside 12-year-old",
        bottleStatedAge: null,
        release: {
          edition: null,
          statedAge: 12,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          singleCask: null,
          caskStrength: null,
        },
      }),
    ).toEqual({
      name: "Speyside 12-year-old",
      fullName: "Shieldaig Speyside 12-year-old",
    });
  });

  test("does not duplicate a release year already encoded by the edition", () => {
    const release = getResolvedReleaseIdentity({
      bottle: {
        name: "Annual Selection",
        fullName: "Example Annual Selection",
        statedAge: null,
      },
      release: {
        edition: "2022 Edition",
        statedAge: null,
        releaseYear: 2022,
        vintageYear: null,
        abv: null,
        singleCask: null,
        caskStrength: null,
      },
    });

    expect(release).toMatchObject({
      edition: "2022 Edition",
      releaseYear: 2022,
    });
    expect(
      formatCanonicalReleaseName({
        bottleName: "Annual Selection",
        bottleFullName: "Example Annual Selection",
        bottleStatedAge: null,
        release,
      }),
    ).toEqual({
      name: "Annual Selection - 2022 Edition",
      fullName: "Example Annual Selection - 2022 Edition",
    });
  });

  test("matches YEAR Edition case-insensitively for display deduplication", () => {
    expect(
      formatCanonicalReleaseName({
        bottleName: "Annual Selection",
        bottleFullName: "Example Annual Selection",
        bottleStatedAge: null,
        release: {
          edition: "2022 EDITION",
          statedAge: null,
          releaseYear: 2022,
          vintageYear: null,
          abv: null,
          singleCask: null,
          caskStrength: null,
        },
      }),
    ).toEqual({
      name: "Annual Selection - 2022 EDITION",
      fullName: "Example Annual Selection - 2022 EDITION",
    });
  });

  test.each([
    {
      edition: "2021 Edition",
      releaseYear: 2022,
      expectedEdition: "2021 Edition",
    },
    {
      edition: "Limited Edition",
      releaseYear: 2022,
      expectedEdition: "Limited Edition",
    },
    {
      edition: "2022A Edition",
      releaseYear: 2022,
      expectedEdition: "2022A Edition",
    },
    {
      edition: "Batch 2022",
      releaseYear: 2022,
      expectedEdition: "Batch 2022",
    },
    {
      edition: "2022 Vintage",
      releaseYear: 2022,
      expectedEdition: "2022 Vintage",
    },
  ])(
    "keeps release year separate from $edition",
    ({ edition, releaseYear, expectedEdition }) => {
      expect(
        formatCanonicalReleaseName({
          bottleName: "Annual Selection",
          bottleFullName: "Example Annual Selection",
          bottleStatedAge: null,
          release: {
            edition,
            statedAge: null,
            releaseYear,
            vintageYear: null,
            abv: null,
            singleCask: null,
            caskStrength: null,
          },
        }),
      ).toEqual({
        name: `Annual Selection - ${expectedEdition} - ${releaseYear} Release`,
        fullName: `Example Annual Selection - ${expectedEdition} - ${releaseYear} Release`,
      });
    },
  );

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
