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
        enforceCreateWebEvidence: false,
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
});
