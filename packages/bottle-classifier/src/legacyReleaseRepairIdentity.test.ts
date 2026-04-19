import { describe, expect, test } from "vitest";

import {
  deriveLegacyReleaseRepairIdentity,
  getLegacyReleaseRepairBlockingParent,
  getLegacyReleaseRepairParentMode,
  hasVariantLegacyReleaseRepairParentName,
  resolveLegacyReleaseRepairNameScope,
  resolveLegacyReleaseRepairParentMatch,
  type LegacyReleaseRepairParentCandidate,
} from "./legacyReleaseRepairIdentity";

const LEGACY_RELEASE_REPAIR_IDENTITY_CASES = [
  {
    expected: {
      edition: "Batch 24",
      proposedParentFullName: "Springbank 12 Cask Strength",
      releaseYear: null,
    },
    name: "Springbank 12 Cask Strength Batch 24",
  },
  {
    expected: {
      edition: null,
      proposedParentFullName: "Lagavulin Distillers Edition",
      releaseYear: 2011,
    },
    name: "Lagavulin Distillers Edition 2011 Release",
  },
  {
    expected: {
      edition: "Batch C923",
      proposedParentFullName: "Elijah Craig Barrel Proof",
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

function buildParentCandidate(
  overrides: Partial<LegacyReleaseRepairParentCandidate> = {},
): LegacyReleaseRepairParentCandidate {
  return {
    id: 1,
    fullName: "Lagavulin Distillers Edition",
    category: "single_malt",
    totalTastings: 10,
    edition: null,
    statedAge: null,
    releaseYear: null,
    vintageYear: null,
    abv: null,
    singleCask: null,
    caskStrength: null,
    caskFill: null,
    caskType: null,
    caskSize: null,
    ...overrides,
  };
}

describe("deriveLegacyReleaseRepairIdentity", () => {
  for (const testCase of LEGACY_RELEASE_REPAIR_IDENTITY_CASES) {
    test(testCase.name, () => {
      const result = deriveLegacyReleaseRepairIdentity({
        fullName: testCase.name,
      });

      if (testCase.expected === null) {
        expect(result).toBeNull();
        return;
      }

      expect(result).toMatchObject(testCase.expected);
    });
  }

  test("ignores descriptive structured editions that are not strong release markers", () => {
    expect(
      deriveLegacyReleaseRepairIdentity({
        fullName: "Pinhook 8-year-old - The Single Barrel / Vertical",
        edition: "The Single Barrel / Vertical",
      }),
    ).toBeNull();
  });

  test("does not treat Small Batch family wording as a batch marker", () => {
    expect(
      deriveLegacyReleaseRepairIdentity({
        fullName: "Four Roses Limited Edition Small Batch 2017",
      }),
    ).toBeNull();
  });

  test("supports structured numbered editions without forcing batch semantics", () => {
    expect(
      deriveLegacyReleaseRepairIdentity({
        fullName: "Highland Park Cask Strength No. 5",
        edition: "No. 5",
      }),
    ).toMatchObject({
      proposedParentFullName: "Highland Park Cask Strength",
      edition: "No. 5",
      releaseYear: null,
    });
  });

  test("derives explicit release-number markers from the raw name", () => {
    expect(
      deriveLegacyReleaseRepairIdentity({
        fullName: "Highland Park Cask Strength Release No. 5",
      }),
    ).toMatchObject({
      proposedParentFullName: "Highland Park Cask Strength",
      edition: "Release No. 5",
      releaseYear: null,
    });
  });
});

describe("release-repair parent matching", () => {
  test("finds exact and variant reusable parents", () => {
    const exactParent = buildParentCandidate({
      id: 11,
      fullName: "Lagavulin Distillers Edition",
      totalTastings: 12,
    });
    const variantParent = buildParentCandidate({
      id: 12,
      fullName: "Lagavulin Edition Distillers",
      totalTastings: 30,
    });

    expect(
      resolveLegacyReleaseRepairParentMatch([exactParent, variantParent], {
        proposedParentFullName: "Lagavulin Distillers Edition",
      }),
    ).toMatchObject({
      matchType: "exact",
      parent: exactParent,
    });

    expect(
      resolveLegacyReleaseRepairParentMatch([variantParent], {
        proposedParentFullName: "Lagavulin Distillers Edition",
      }),
    ).toMatchObject({
      matchType: "variant",
      parent: variantParent,
    });
  });

  test("blocks dirty parents and alias conflicts before create-parent", () => {
    const dirtyParent = buildParentCandidate({
      id: 21,
      fullName: "Springbank 12 Cask Strength",
      edition: "Batch 23",
      totalTastings: 15,
    });

    expect(
      getLegacyReleaseRepairParentMode([dirtyParent], {
        proposedParentFullName: "Springbank 12 Cask Strength",
      }),
    ).toBe("blocked_dirty_parent");

    expect(
      getLegacyReleaseRepairBlockingParent([dirtyParent], {
        proposedParentFullName: "Springbank 12 Cask Strength",
      }),
    ).toEqual(dirtyParent);

    expect(
      getLegacyReleaseRepairParentMode([], {
        proposedParentFullName: "Springbank 12 Cask Strength",
        parentAlias: {
          bottleId: 9,
          releaseId: null,
        },
      }),
    ).toBe("blocked_alias_conflict");
  });

  test("blocks parents with non-marker release traits when the child repair would still conflict", () => {
    const dirtyParent = buildParentCandidate({
      id: 24,
      fullName: "Kilkerran Heavily Peated",
      abv: 58.4,
      totalTastings: 18,
    });

    expect(
      getLegacyReleaseRepairParentMode([dirtyParent], {
        proposedParentFullName: "Kilkerran Heavily Peated",
        release: {
          edition: "Batch 10",
          abv: 58.4,
        },
      }),
    ).toBe("blocked_dirty_parent");

    expect(
      getLegacyReleaseRepairBlockingParent([dirtyParent], {
        proposedParentFullName: "Kilkerran Heavily Peated",
        release: {
          edition: "Batch 10",
          abv: 58.4,
        },
      }),
    ).toEqual(dirtyParent);
  });

  test("falls back to create-parent when no reusable or blocked parent exists", () => {
    expect(
      getLegacyReleaseRepairParentMode([], {
        proposedParentFullName: "Springbank 12 Cask Strength",
      }),
    ).toBe("create_parent");
  });

  test("does not treat stable marketed parent traits as dirty parent blockers", () => {
    const stableParent = buildParentCandidate({
      id: 41,
      fullName: "Springbank 12 Cask Strength",
      caskStrength: true,
      totalTastings: 22,
    });

    expect(
      getLegacyReleaseRepairParentMode([stableParent], {
        proposedParentFullName: "Springbank 12 Cask Strength",
        release: {
          edition: "Batch 24",
          caskStrength: true,
        },
      }),
    ).toBe("existing_parent");
  });

  test("does not variant-match cross-category parents", () => {
    const bourbonParent = buildParentCandidate({
      id: 31,
      fullName: "Westland Single Malt Bourbon",
      category: "bourbon",
      totalTastings: 25,
    });

    expect(
      hasVariantLegacyReleaseRepairParentName(
        "Westland Single Malt",
        "Westland Malt Single",
      ),
    ).toBe(true);

    expect(
      getLegacyReleaseRepairParentMode([bourbonParent], {
        proposedParentFullName: "Westland Malt Single Scotch",
      }),
    ).toBe("create_parent");
  });

  test("does not variant-match when one side repeats a meaningful token", () => {
    expect(
      hasVariantLegacyReleaseRepairParentName(
        "Woodford Reserve Double Double Oaked",
        "Woodford Reserve Double Oaked",
      ),
    ).toBe(false);
  });
});

describe("resolveLegacyReleaseRepairNameScope", () => {
  test("keeps matching marker siblings on the release scope", () => {
    expect(
      resolveLegacyReleaseRepairNameScope({
        name: "Lagavulin Distillers Edition 2011 Release",
        proposedParentFullName: "Lagavulin Distillers Edition",
        releaseIdentity: {
          edition: null,
          releaseYear: 2011,
        },
      }),
    ).toBe("release");
  });

  test("keeps conflicting sibling markers on the parent scope", () => {
    expect(
      resolveLegacyReleaseRepairNameScope({
        name: "Lagavulin Distillers Edition 2012 Release",
        proposedParentFullName: "Lagavulin Distillers Edition",
        releaseIdentity: {
          edition: null,
          releaseYear: 2011,
        },
      }),
    ).toBe("parent");
  });
});
