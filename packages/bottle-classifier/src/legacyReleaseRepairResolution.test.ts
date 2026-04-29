import { describe, expect, it } from "vitest";
import {
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
} from "./contract";
import { buildLegacyReleaseRepairParentCandidate } from "./evalFixtureBuilders";
import {
  getLegacyReleaseRepairClassifierBlockedReasonMessage,
  resolveLegacyCreateParentClassification,
} from "./legacyReleaseRepairResolution";

describe("resolveLegacyCreateParentClassification", () => {
  it("reuses a clean parent bottle for match decisions", () => {
    const parentRows = [
      buildLegacyReleaseRepairParentCandidate({
        id: 620,
        fullName: "Elijah Craig Barrel Proof",
      }),
    ];

    const resolution = resolveLegacyCreateParentClassification({
      classification: createDecidedBottleClassification({
        decision: {
          action: "match",
          candidateBottleIds: [620],
          confidence: 94,
          identityScope: "product",
          matchedBottleId: 620,
          matchedReleaseId: null,
          observation: null,
          parentBottleId: null,
          proposedBottle: null,
          proposedRelease: null,
          rationale: "Exact product match.",
        },
        artifacts: {},
      }),
      parentRows,
    });

    expect(resolution).toMatchObject({
      resolution: "reuse_existing_parent",
      parentBottle: {
        id: 620,
      },
    });
  });

  it("reuses a clean parent bottle for same-bottle repair decisions", () => {
    const parentRows = [
      buildLegacyReleaseRepairParentCandidate({
        id: 620,
        fullName: "Elijah Craig Barrel Proof",
      }),
    ];

    const resolution = resolveLegacyCreateParentClassification({
      classification: createDecidedBottleClassification({
        decision: {
          action: "repair_bottle",
          candidateBottleIds: [620],
          confidence: 94,
          identityScope: "product",
          matchedBottleId: 620,
          matchedReleaseId: null,
          observation: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Barrel Proof",
            series: null,
            category: "bourbon",
            edition: null,
            statedAge: null,
            caskStrength: true,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "Elijah Craig",
            },
            distillers: [],
            bottler: null,
          },
          proposedRelease: null,
          rationale:
            "Existing reusable parent is right, but facts need repair.",
        },
        artifacts: {},
      }),
      parentRows,
    });

    expect(resolution).toMatchObject({
      resolution: "reuse_existing_parent",
      parentBottle: {
        id: 620,
      },
    });
  });

  it("blocks exact-cask decisions", () => {
    const resolution = resolveLegacyCreateParentClassification({
      classification: createDecidedBottleClassification({
        decision: {
          action: "match",
          candidateBottleIds: [610],
          confidence: 98,
          identityScope: "exact_cask",
          matchedBottleId: 610,
          matchedReleaseId: null,
          observation: null,
          parentBottleId: null,
          proposedBottle: null,
          proposedRelease: null,
          rationale: "SMWS code identifies an exact-cask bottle.",
        },
        artifacts: {},
      }),
      parentRows: [],
    });

    expect(resolution).toEqual({
      resolution: "blocked",
      reason: "classifier_exact_cask",
    });
    expect(
      getLegacyReleaseRepairClassifierBlockedReasonMessage({
        reason: "classifier_exact_cask",
      }),
    ).toContain("exact-cask identity");
  });

  it("blocks candidate matches outside the reviewed parent set", () => {
    const resolution = resolveLegacyCreateParentClassification({
      classification: createDecidedBottleClassification({
        decision: {
          action: "create_release",
          candidateBottleIds: [501],
          confidence: 81,
          identityScope: "product",
          matchedBottleId: null,
          matchedReleaseId: null,
          observation: null,
          parentBottleId: 501,
          proposedBottle: null,
          proposedRelease: {
            edition: "2011 Release",
            statedAge: null,
            releaseYear: null,
            vintageYear: null,
            abv: null,
            caskStrength: null,
            singleCask: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            description: null,
            tastingNotes: null,
            imageUrl: null,
          },
          rationale: "Treat this as a release under a known parent.",
        },
        artifacts: {},
      }),
      parentRows: [],
    });

    expect(resolution).toEqual({
      resolution: "blocked",
      reason: "classifier_outside_parent_set",
    });
  });

  it("blocks dirty reusable parent candidates", () => {
    const parentRows = [
      buildLegacyReleaseRepairParentCandidate({
        id: 661,
        fullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
        edition: "Batch 4",
        statedAge: 15,
      }),
    ];

    const resolution = resolveLegacyCreateParentClassification({
      classification: createDecidedBottleClassification({
        decision: {
          action: "match",
          candidateBottleIds: [661],
          confidence: 97,
          identityScope: "product",
          matchedBottleId: 661,
          matchedReleaseId: null,
          observation: null,
          parentBottleId: null,
          proposedBottle: null,
          proposedRelease: null,
          rationale: "Exact legacy bottle hit.",
        },
        artifacts: {},
      }),
      parentRows,
    });

    expect(resolution).toEqual({
      resolution: "blocked",
      reason: "classifier_dirty_parent_candidate",
    });
  });

  it("allows create-parent when the classifier cannot reuse an existing bottle", () => {
    const resolution = resolveLegacyCreateParentClassification({
      classification: createDecidedBottleClassification({
        decision: {
          action: "create_bottle_and_release",
          candidateBottleIds: [],
          confidence: 74,
          identityScope: "product",
          matchedBottleId: null,
          matchedReleaseId: null,
          observation: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Elijah Craig Barrel Proof",
            series: null,
            category: "bourbon",
            edition: null,
            statedAge: 12,
            caskStrength: true,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "Elijah Craig",
            },
            distillers: [],
            bottler: null,
          },
          proposedRelease: {
            edition: "Batch C923",
            statedAge: null,
            releaseYear: null,
            vintageYear: null,
            abv: null,
            caskStrength: null,
            singleCask: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            description: null,
            tastingNotes: null,
            imageUrl: null,
          },
          rationale: "No safe reusable parent bottle exists locally.",
        },
        artifacts: {},
      }),
      parentRows: [],
    });

    expect(resolution).toEqual({
      resolution: "allow_create_parent",
    });
  });

  it("blocks ignored classifier results with the ignored reason attached", () => {
    const resolution = resolveLegacyCreateParentClassification({
      classification: createIgnoredBottleClassification({
        reason: "non-whisky novelty listing",
        artifacts: {},
      }),
      parentRows: [],
    });

    expect(resolution).toEqual({
      resolution: "blocked",
      reason: "classifier_ignored",
      ignoredReason: "non-whisky novelty listing",
    });
    expect(
      getLegacyReleaseRepairClassifierBlockedReasonMessage({
        reason: "classifier_ignored",
        ignoredReason: "non-whisky novelty listing",
      }),
    ).toBe(
      "Classifier could not review parent resolution: non-whisky novelty listing",
    );
  });
});
