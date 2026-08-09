import { describe, expect, test } from "vitest";

import {
  bottleMarketsStatedAge,
  formatCanonicalBottleName,
  getResolvedBottleIdentity,
  hasBottleStatedAgeConflict,
} from "./bottleIdentity";

describe("bottleIdentity", () => {
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

  test("flags shared-age conflicts only when the Bottle does not market that age", () => {
    expect(
      hasBottleStatedAgeConflict({
        bottle: {
          name: "Private Selection",
          fullName: "Maker's Mark Private Selection",
          statedAge: 10,
        },
        exactStatedAge: 12,
      }),
    ).toBe(true);

    expect(
      hasBottleStatedAgeConflict({
        bottle: {
          name: "Lagavulin 16",
          fullName: "Lagavulin 16-year-old",
          statedAge: 16,
        },
        exactStatedAge: 12,
      }),
    ).toBe(false);
  });

  test("resolves Bottle identity without duplicating the shared age", () => {
    const resolved = getResolvedBottleIdentity({
      bottle: {
        name: "Lagavulin Distillers Edition",
        fullName: "Lagavulin Distillers Edition",
        statedAge: 16,
      },
      exact: {
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
      formatCanonicalBottleName({
        bottleName: "Lagavulin Distillers Edition",
        bottleFullName: "Lagavulin Distillers Edition",
        bottleStatedAge: 16,
        exact: resolved,
      }),
    ).toEqual({
      name: "Lagavulin Distillers Edition - 2011 Release - 43.0% ABV",
      fullName: "Lagavulin Distillers Edition - 2011 Release - 43.0% ABV",
    });
  });

  test("does not duplicate exact age already marketed in the stable name", () => {
    expect(
      formatCanonicalBottleName({
        bottleName: "Speyside 12-year-old",
        bottleFullName: "Shieldaig Speyside 12-year-old",
        bottleStatedAge: null,
        exact: {
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
    const exact = getResolvedBottleIdentity({
      bottle: {
        name: "Annual Selection",
        fullName: "Example Annual Selection",
        statedAge: null,
      },
      exact: {
        edition: "2022 Edition",
        statedAge: null,
        releaseYear: 2022,
        vintageYear: null,
        abv: null,
        singleCask: null,
        caskStrength: null,
      },
    });

    expect(exact).toMatchObject({
      edition: "2022 Edition",
      releaseYear: 2022,
    });
    expect(
      formatCanonicalBottleName({
        bottleName: "Annual Selection",
        bottleFullName: "Example Annual Selection",
        bottleStatedAge: null,
        exact,
      }),
    ).toEqual({
      name: "Annual Selection - 2022 Edition",
      fullName: "Example Annual Selection - 2022 Edition",
    });
  });

  test("matches YEAR Edition case-insensitively for display deduplication", () => {
    expect(
      formatCanonicalBottleName({
        bottleName: "Annual Selection",
        bottleFullName: "Example Annual Selection",
        bottleStatedAge: null,
        exact: {
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
        formatCanonicalBottleName({
          bottleName: "Annual Selection",
          bottleFullName: "Example Annual Selection",
          bottleStatedAge: null,
          exact: {
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

  test("does not duplicate traits already present in the Bottle name", () => {
    expect(
      formatCanonicalBottleName({
        bottleName: "Glendronach 1972 Single Cask",
        bottleFullName: "Glendronach 1972 Single Cask",
        bottleNameTraits: {
          singleCask: true,
        },
        bottleStatedAge: 48,
        exact: {
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
});
