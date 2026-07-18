import { describe, expect, test } from "vitest";

import {
  deriveLegacyReleaseIdentityEvidence,
  hasVariantLegacyReleaseFamilyName,
} from "./legacyReleaseIdentityEvidence";

const LEGACY_RELEASE_IDENTITY_EVIDENCE_CASES = [
  {
    expected: {
      edition: "Batch 24",
      markerSources: ["name_batch"],
      releaseYear: null,
    },
    name: "Springbank 12 Cask Strength Batch 24",
  },
  {
    expected: {
      edition: null,
      markerSources: ["name_release_year"],
      releaseYear: 2011,
    },
    name: "Lagavulin Distillers Edition 2011 Release",
  },
  {
    expected: {
      edition: "Batch C923",
      markerSources: ["name_batch"],
      releaseYear: null,
    },
    name: "Elijah Craig Barrel Proof Batch C923",
  },
  {
    expected: null,
    name: "Maker's Mark Private Selection S2B13",
  },
  {
    expected: null,
    name: "Talisker 2001 The Distillers Edition",
  },
  {
    expected: null,
    name: "SMWS 6.53",
  },
] as const;

describe("deriveLegacyReleaseIdentityEvidence", () => {
  for (const testCase of LEGACY_RELEASE_IDENTITY_EVIDENCE_CASES) {
    test(testCase.name, () => {
      const result = deriveLegacyReleaseIdentityEvidence({
        fullName: testCase.name,
      });

      if (testCase.expected === null) {
        expect(result).toBeNull();
        return;
      }

      expect(result).toEqual(testCase.expected);
    });
  }

  test("ignores descriptive structured editions that are not strong release markers", () => {
    expect(
      deriveLegacyReleaseIdentityEvidence({
        fullName: "Pinhook 8-year-old - The Single Barrel / Vertical",
        edition: "The Single Barrel / Vertical",
      }),
    ).toBeNull();
  });

  test("does not treat Small Batch family wording as a batch marker", () => {
    expect(
      deriveLegacyReleaseIdentityEvidence({
        fullName: "Example Limited Edition Small Batch 2017",
      }),
    ).toBeNull();
  });

  test("supports structured numbered editions without forcing batch semantics", () => {
    expect(
      deriveLegacyReleaseIdentityEvidence({
        fullName: "Highland Park Cask Strength No. 5",
        edition: "No. 5",
      }),
    ).toEqual({
      edition: "No. 5",
      markerSources: ["structured_edition"],
      releaseYear: null,
    });
  });

  test("derives explicit release-number markers from the raw name", () => {
    expect(
      deriveLegacyReleaseIdentityEvidence({
        fullName: "Highland Park Cask Strength Release No. 5",
      }),
    ).toEqual({
      edition: "Release No. 5",
      markerSources: ["name_batch"],
      releaseYear: null,
    });
  });
});

describe("legacy candidate name comparison", () => {
  test("recognizes token-equivalent legacy candidate names", () => {
    expect(
      hasVariantLegacyReleaseFamilyName(
        "Westland Single Malt",
        "Westland Malt Single",
      ),
    ).toBe(true);
  });

  test("does not variant-match when one side repeats a meaningful token", () => {
    expect(
      hasVariantLegacyReleaseFamilyName(
        "Woodford Reserve Double Double Oaked",
        "Woodford Reserve Double Oaked",
      ),
    ).toBe(false);
  });
});
