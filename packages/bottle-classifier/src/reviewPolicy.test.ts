import { describe, expect, test } from "vitest";
import type {
  BottleCandidate,
  BottleClassifierAgentDecisionInput,
} from "./classifierTypes";
import { buildBottleClassificationArtifacts } from "./contract";
import { finalizeBottleReferenceClassification } from "./reviewPolicy";

const existingPrivateCask: BottleCandidate = {
  bottleId: 100,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Example Private Cask",
  bottleFullName: "Example Private Cask",
  brand: "Example",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: true,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.9,
  source: ["exact"],
};

const wrongFamilyExactCodeCandidate: BottleCandidate = {
  ...existingPrivateCask,
  bottleId: 101,
  alias: "Other Private Cask No. 12.1",
  fullName: "Other Private Cask No. 12.1",
  bottleFullName: "Other Private Cask No. 12.1",
  brand: "Other",
};

const repairParentCandidate: BottleCandidate = {
  bottleId: 730,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Maker's Mark Private Selection",
  bottleFullName: "Maker's Mark Private Selection",
  brand: "Maker's Mark",
  bottler: null,
  series: null,
  distillery: [],
  category: "bourbon",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: null,
  source: ["repair_parent"],
};

const ageBearingParentCandidate: BottleCandidate = {
  bottleId: 44175,
  releaseId: null,
  kind: "bottle",
  alias: "Shieldaig Speyside",
  fullName: "Shieldaig Speyside",
  bottleFullName: "Shieldaig Speyside",
  brand: "Shieldaig",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: 18,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 1,
  source: ["exact"],
};

describe("finalizeBottleReferenceClassification", () => {
  test("does not let generic cask details bypass duplicate product creation checks", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_bottle",
      confidence: 88,
      rationale:
        "The source appears to describe a private cask product, but not a separate exact-cask bottle identity.",
      candidateBottleIds: [existingPrivateCask.bottleId],
      identityScope: null,
      observation: {
        caskNumber: "123",
        barrelNumber: null,
        bottleNumber: null,
        outturn: null,
        market: null,
        exclusive: null,
        selector: null,
      },
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: {
        name: "Private Cask",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: null,
        caskStrength: null,
        singleCask: true,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example",
        },
        distillers: [],
        bottler: null,
      },
      proposedRelease: null,
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Example Private Cask No. 123",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [existingPrivateCask],
      }),
      options: {
        enforceCreateWebEvidence: true,
      },
    });

    expect(result).toMatchObject({
      action: "no_match",
      identityScope: "product",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    });
    expect(result.rationale).toContain("duplicates an existing local bottle");
  });

  test("does not resolve exact-cask creation to a wrong-family code match", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_bottle",
      confidence: 91,
      rationale:
        "The source and web evidence support an exact-cask bottle for Example.",
      candidateBottleIds: [wrongFamilyExactCodeCandidate.bottleId],
      identityScope: "exact_cask",
      observation: {
        caskNumber: "12.1",
        barrelNumber: null,
        bottleNumber: null,
        outturn: null,
        market: null,
        exclusive: null,
        selector: null,
      },
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: {
        name: "Private Cask No. 12.1",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: null,
        caskStrength: null,
        singleCask: true,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        brand: {
          id: null,
          name: "Example",
        },
        distillers: [],
        bottler: null,
      },
      proposedRelease: null,
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Example Private Cask No. 12.1",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [wrongFamilyExactCodeCandidate],
        extractedIdentity: {
          brand: "Example",
          bottler: null,
          expression: "Private Cask No. 12.1",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
      }),
      options: {
        enforceCreateWebEvidence: false,
      },
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedRelease: null,
    });
  });

  test("lets reviewed repair parents anchor child release creation", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_release",
      confidence: 92,
      rationale:
        "The local repair parent is the reusable product and S2B13 is release identity.",
      candidateBottleIds: [repairParentCandidate.bottleId],
      identityScope: "product",
      observation: null,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: repairParentCandidate.bottleId,
      proposedBottle: null,
      proposedRelease: {
        edition: "S2B13",
        statedAge: null,
        abv: null,
        releaseYear: null,
        vintageYear: null,
        caskStrength: null,
        singleCask: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
      },
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Maker's Mark Private Selection S2B13",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [repairParentCandidate],
        extractedIdentity: {
          brand: "Maker's Mark",
          bottler: null,
          expression: null,
          series: null,
          distillery: [],
          category: "bourbon",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: "S2B13",
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_release",
      identityScope: "product",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: repairParentCandidate.bottleId,
      proposedBottle: null,
      proposedRelease: {
        edition: "S2B13",
      },
    });
  });

  test("downgrades release creation when the parent has conflicting bottle-level release traits", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_release",
      confidence: 90,
      rationale:
        "The local parent matches the family, but the source age differs.",
      candidateBottleIds: [ageBearingParentCandidate.bottleId],
      identityScope: "product",
      observation: null,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: ageBearingParentCandidate.bottleId,
      proposedBottle: null,
      proposedRelease: {
        edition: null,
        statedAge: 21,
        abv: null,
        releaseYear: null,
        vintageYear: null,
        caskStrength: null,
        singleCask: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
      },
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Shieldaig Speyside Single Malt 21-year-old Scotch Whisky",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [ageBearingParentCandidate],
        extractedIdentity: {
          brand: "Shieldaig",
          bottler: null,
          expression: "Speyside",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: 21,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
      }),
      options: {
        enforceCreateWebEvidence: false,
      },
    });

    expect(result).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      parentBottleId: null,
      proposedRelease: null,
    });
    expect(result.rationale).toContain("repair_parent_and_create_release");
  });

  test("keeps parent repair plus release creation decisions", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "repair_parent_and_create_release",
      confidence: 90,
      rationale:
        "The existing parent should be repaired into a clean reusable Shieldaig Speyside bottle before creating the supported 21-year-old child release.",
      candidateBottleIds: [ageBearingParentCandidate.bottleId],
      identityScope: "product",
      observation: null,
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: ageBearingParentCandidate.bottleId,
      proposedBottle: {
        name: "Speyside",
        brand: {
          name: "Shieldaig",
        },
        bottler: null,
        series: null,
        category: "single_malt",
        statedAge: null,
        abv: null,
        caskStrength: null,
        singleCask: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        edition: null,
        distillers: [],
      },
      proposedRelease: {
        edition: null,
        statedAge: 21,
        abv: null,
        releaseYear: null,
        vintageYear: null,
        caskStrength: null,
        singleCask: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
      },
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Shieldaig Speyside Single Malt 21-year-old Scotch Whisky",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [ageBearingParentCandidate],
        extractedIdentity: {
          brand: "Shieldaig",
          bottler: null,
          expression: "Speyside",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: 21,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
      }),
      options: {
        enforceCreateWebEvidence: true,
      },
    });

    expect(result).toMatchObject({
      action: "repair_parent_and_create_release",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: ageBearingParentCandidate.bottleId,
      proposedBottle: {
        name: "Speyside",
        brand: {
          name: "Shieldaig",
        },
        statedAge: null,
      },
      proposedRelease: {
        statedAge: 21,
      },
    });
  });
});
