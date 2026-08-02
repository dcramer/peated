import { describe, expect, test } from "vitest";

import { exactBottleIdentityMatches } from "./normalizationEvalScoring";

describe("Bottle normalization eval scoring", () => {
  test("ignores compatibility cask metadata while retaining exact edition and year checks", () => {
    const actualWithCompatibilityMetadata = {
      edition: "Volume V Release",
      releaseYear: 2024,
      vintageYear: 2012,
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "refill",
    };

    expect(
      exactBottleIdentityMatches(actualWithCompatibilityMetadata, {
        edition: "Volume 5",
        releaseYear: 2024,
        vintageYear: 2012,
      }),
    ).toBe(true);
    expect(
      exactBottleIdentityMatches(actualWithCompatibilityMetadata, {
        edition: "Volume 6",
      }),
    ).toBe(false);
    expect(
      exactBottleIdentityMatches(actualWithCompatibilityMetadata, {
        releaseYear: 2023,
      }),
    ).toBe(false);
    expect(
      exactBottleIdentityMatches(actualWithCompatibilityMetadata, {
        vintageYear: 2011,
      }),
    ).toBe(false);
  });
});
