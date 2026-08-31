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
        bottlingYear: 2010,
        abv: 43,
        singleCask: null,
        caskStrength: null,
      },
    });

    expect(resolved.statedAge).toBe(16);
    expect(resolved.bottlingYear).toBe(2010);
  });

  test("adds the marketed edition to the stable expression", () => {
    expect(
      formatCanonicalBottleName({
        bottleName: "Annual Selection",
        bottleFullName: "Example Annual Selection",
        edition: "2022 Edition",
      }),
    ).toEqual({
      name: "Annual Selection - 2022 Edition",
      fullName: "Example Annual Selection - 2022 Edition",
    });
  });

  test("does not repeat an edition already present in the expression", () => {
    expect(
      formatCanonicalBottleName({
        bottleName: "Annual Selection 2022 EDITION",
        bottleFullName: "Example Annual Selection 2022 EDITION",
        edition: "2022 Edition",
      }),
    ).toEqual({
      name: "Annual Selection 2022 EDITION",
      fullName: "Example Annual Selection 2022 EDITION",
    });

    expect(
      formatCanonicalBottleName({
        bottleName: "Annual Selection Act 10",
        bottleFullName: "Example Annual Selection Act 10",
        edition: "Act 1",
      }),
    ).toEqual({
      name: "Annual Selection Act 10 - Act 1",
      fullName: "Example Annual Selection Act 10 - Act 1",
    });
  });

  test("keeps SMWS and other exact-cask names on the general path", () => {
    expect(
      formatCanonicalBottleName({
        bottleName: "64.149 A cake walk in the Black Forest",
        bottleFullName: "SMWS 64.149 A cake walk in the Black Forest",
        edition: null,
      }),
    ).toEqual({
      name: "64.149 A cake walk in the Black Forest",
      fullName: "SMWS 64.149 A cake walk in the Black Forest",
    });
    expect(
      formatCanonicalBottleName({
        bottleName: "64.149 Private Selection",
        bottleFullName: "Example Brand 64.149 Private Selection",
        edition: null,
      }),
    ).toEqual({
      name: "64.149 Private Selection",
      fullName: "Example Brand 64.149 Private Selection",
    });
  });
});
