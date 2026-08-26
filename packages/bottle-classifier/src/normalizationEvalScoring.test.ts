import { describe, expect, test } from "vitest";

import { exactBottleIdentityMatches } from "./normalizationEvalScoring";

describe("Bottle normalization eval scoring", () => {
  test("ignores maturation and outturn while retaining edition and year checks", () => {
    const actualWithCaskDetails = {
      edition: "Volume V Release",
      releaseYear: 2024,
      vintageYear: 2012,
      maturation: "Bourbon barrel",
      outturn: 180,
    };

    expect(
      exactBottleIdentityMatches(actualWithCaskDetails, {
        edition: "Volume 5",
        releaseYear: 2024,
        vintageYear: 2012,
      }),
    ).toBe(true);
    expect(
      exactBottleIdentityMatches(actualWithCaskDetails, {
        edition: "Volume 6",
      }),
    ).toBe(false);
    expect(
      exactBottleIdentityMatches(actualWithCaskDetails, {
        releaseYear: 2023,
      }),
    ).toBe(false);
    expect(
      exactBottleIdentityMatches(actualWithCaskDetails, {
        vintageYear: 2011,
      }),
    ).toBe(false);
  });
});
