import { describe, expect, test } from "vitest";
import type {
  BottleCandidate,
  BottleClassifierAgentDecisionInput,
} from "./classifierTypes";
import { buildBottleClassificationArtifacts } from "./contract";
import { finalizeBottleReferenceClassification } from "./reviewPolicy";

const existingPrivateCask: BottleCandidate = {
  bottleId: 100,
  alias: null,
  fullName: "Example Private Cask",
  brand: "Example",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: true,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.9,
  source: ["exact"],
};

const wrongFamilyExactCodeCandidate: BottleCandidate = {
  ...existingPrivateCask,
  bottleId: 101,
  alias: "Other Private Cask No. 12.1",
  fullName: "Other Private Cask No. 12.1",
  brand: "Other",
};

const ageBearingCandidate: BottleCandidate = {
  bottleId: 44175,
  alias: "Shieldaig Speyside",
  fullName: "Shieldaig Speyside",
  brand: "Shieldaig",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: 18,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 1,
  source: ["exact"],
};

const shieldaigSiblingAgeCandidate: BottleCandidate = {
  ...ageBearingCandidate,
  bottleId: 44176,
  alias: "Shieldaig Speyside 25-year-old",
  fullName: "Shieldaig Speyside 25-year-old",
  statedAge: 25,
  familyContext: {
    siblingBottles: [
      {
        bottleId: 44175,
        fullName: "Shieldaig Speyside 18-year-old",
        traitFields: ["statedAge"],
        statedAge: 18,
        edition: null,
        releaseYear: null,
        vintageYear: null,
        abv: null,
        caskStrength: null,
        singleCask: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
      },
    ],
  },
};

function buildShieldaigAgeCreationDecision(
  proposedBottleName: string,
): BottleClassifierAgentDecisionInput {
  return {
    action: "create_bottle",
    rationale:
      "The source supports a new Shieldaig Speyside 30-year-old bottle distinct from existing age-stated siblings.",
    candidateBottleIds: [ageBearingCandidate.bottleId],
    identityScope: "product",
    observation: null,
    confidenceBasis: {
      positiveEvidence: ["source title states 30-year-old"],
      unresolvedRisks: [
        {
          category: "sibling_ambiguity",
          note: "same-family aged bottle siblings exist",
        },
      ],
      webEvidence: "not_used",
    },
    matchedBottleId: null,
    proposedBottle: {
      name: proposedBottleName,
      series: null,
      category: "single_malt",
      edition: null,
      statedAge: 30,
      caskStrength: null,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      brand: {
        id: null,
        name: "Shieldaig",
      },
      distillers: [],
      bottler: null,
    },
  };
}

function classifyShieldaigAgeCreation(
  decision: BottleClassifierAgentDecisionInput,
) {
  return finalizeBottleReferenceClassification({
    reference: {
      name: "Shieldaig Speyside Sin Malt 30-year-old Scotch Whisky",
    },
    decision,
    artifacts: buildBottleClassificationArtifacts({
      candidates: [ageBearingCandidate, shieldaigSiblingAgeCandidate],
      extractedIdentity: {
        brand: "Shieldaig",
        bottler: null,
        expression: "Speyside",
        series: null,
        distillery: [],
        category: "single_malt",
        stated_age: 30,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: null,
      },
    }),
  });
}

function classifyAgeCreationWithoutSiblingConflict(
  decision: BottleClassifierAgentDecisionInput,
) {
  return finalizeBottleReferenceClassification({
    reference: {
      name: "Shieldaig Speyside Sin Malt 30-year-old Scotch Whisky",
    },
    decision,
    artifacts: buildBottleClassificationArtifacts({
      candidates: [],
      extractedIdentity: {
        brand: "Shieldaig",
        bottler: null,
        expression: "Speyside",
        series: null,
        distillery: [],
        category: "single_malt",
        stated_age: 30,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: null,
      },
    }),
  });
}

function classifyStructuredExactName({
  referenceName,
  proposedName,
  brand = "Example",
  expression,
  edition = null,
  vintageYear = null,
  releaseYear = null,
}: {
  referenceName: string;
  proposedName: string;
  brand?: string;
  expression: string | null;
  edition?: string | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
}) {
  return finalizeBottleReferenceClassification({
    reference: { name: referenceName },
    decision: {
      action: "create_bottle",
      rationale: "The reviewed source supports one complete Bottle.",
      candidateBottleIds: [],
      identityScope: "product",
      observation: null,
      matchedBottleId: null,
      proposedBottle: {
        name: proposedName,
        series: null,
        category: "single_malt",
        edition,
        statedAge: null,
        caskStrength: null,
        singleCask: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        abv: null,
        vintageYear,
        releaseYear,
        brand: { id: null, name: brand },
        distillers: [],
        bottler: null,
      },
    },
    artifacts: buildBottleClassificationArtifacts({
      candidates: [],
      extractedIdentity: {
        brand,
        bottler: null,
        expression,
        series: null,
        distillery: [],
        category: "single_malt",
        stated_age: null,
        abv: null,
        release_year: releaseYear,
        vintage_year: vintageYear,
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition,
      },
    }),
  });
}

describe("finalizeBottleReferenceClassification", () => {
  test("removes a parenthesized structured edition without leaving empty punctuation", () => {
    const result = classifyStructuredExactName({
      referenceName: "Elijah Craig Barrel Proof Batch C923",
      proposedName: "Barrel Proof (Batch C923)",
      brand: "Elijah Craig",
      expression: "Barrel Proof",
      edition: "Batch C923",
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Barrel Proof",
        edition: "Batch C923",
      },
    });
  });

  test("collapses internal dash separators after removing a structured edition", () => {
    const result = classifyStructuredExactName({
      referenceName: "Example Special Reserve Batch 2 Cask Strength",
      proposedName: "Special Reserve - Batch 2 - Cask Strength",
      expression: "Special Reserve Cask Strength",
      edition: "Batch 2",
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Special Reserve - Cask Strength",
        edition: "Batch 2",
      },
    });
  });

  test("collapses internal comma separators after removing a structured edition", () => {
    const result = classifyStructuredExactName({
      referenceName: "Example Special Reserve Batch 2 Cask Strength",
      proposedName: "Special Reserve, Batch 2, Cask Strength",
      expression: "Special Reserve Cask Strength",
      edition: "Batch 2",
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Special Reserve Cask Strength",
        edition: "Batch 2",
      },
    });
  });

  test.each(["Classic Cut 2021 Edition", "Classic Cut - 2021 Edition"])(
    "keeps the stable Macallan expression after removing structured edition and year from %s",
    (proposedName) => {
      const result = classifyStructuredExactName({
        referenceName: "The Macallan Classic Cut 2021 Edition",
        proposedName,
        brand: "The Macallan",
        expression: "Classic Cut",
        edition: "2021 Edition",
        releaseYear: 2021,
      });

      expect(result).toMatchObject({
        action: "create_bottle",
        proposedBottle: {
          name: "Classic Cut",
          edition: "2021 Edition",
          releaseYear: 2021,
        },
      });
    },
  );

  test("removes a labeled structured vintage from the stable expression", () => {
    const result = classifyStructuredExactName({
      referenceName: "Example Special Reserve 1994 Vintage",
      proposedName: "Special Reserve 1994 Vintage",
      expression: "Special Reserve",
      vintageYear: 1994,
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Special Reserve",
        vintageYear: 1994,
      },
    });
  });

  test("rejects a create draft whose name contains only structured exact identity", () => {
    const result = classifyStructuredExactName({
      referenceName: "Example 1994 Vintage",
      proposedName: "1994 Vintage",
      expression: null,
      vintageYear: 1994,
    });

    expect(result).toMatchObject({
      action: "no_match",
      proposedBottle: null,
    });
    expect(result.rationale).toContain(
      "no stable expression distinct from the brand",
    );
  });

  test("rejects a create draft when exact-trait removal leaves only the brand", () => {
    const result = classifyStructuredExactName({
      referenceName: "Example 1994 Vintage",
      proposedName: "1994 Vintage Example",
      expression: null,
      vintageYear: 1994,
    });

    expect(result).toMatchObject({
      action: "no_match",
      proposedBottle: null,
    });
  });

  test("downgrades a create draft when a Bottle with release fields may already cover it", () => {
    const candidate: BottleCandidate = {
      bottleId: 38004,
      alias: "Trestle Spirit of Eclipse",
      fullName: "Trestle Spirit of Eclipse",
      brand: "Old Trestle",
      bottler: "Old Trestle",
      series: null,
      distillery: ["Old Trestle"],
      category: "blend",
      statedAge: null,
      edition: null,
      caskStrength: null,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: null,
      vintageYear: null,
      releaseYear: 2011,
      score: 0.85,
      source: ["vector", "text"],
    };
    const result = finalizeBottleReferenceClassification({
      reference: { name: "Bottle photo upload" },
      decision: {
        action: "create_bottle",
        rationale: "The source shows Trestle Spirit of Eclipse at 50% ABV.",
        candidateBottleIds: [candidate.bottleId],
        identityScope: "product",
        observation: null,
        confidenceBasis: {
          positiveEvidence: ["readable exact bottle label"],
          unresolvedRisks: [
            {
              category: "trait_conflict",
              note: "candidate has a release year and lacks optional ABV",
            },
          ],
          webEvidence: "not_needed",
        },
        matchedBottleId: null,
        proposedBottle: {
          name: "Spirit of Eclipse",
          series: null,
          category: "blend",
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          abv: 50,
          vintageYear: null,
          releaseYear: null,
          brand: { id: null, name: "Trestle" },
          distillers: [{ id: null, name: "Old Trestle" }],
          bottler: { id: null, name: "Old Trestle" },
        },
      },
      artifacts: buildBottleClassificationArtifacts({
        extractedIdentity: {
          brand: "Trestle",
          bottler: "Old Trestle",
          expression: "Spirit of Eclipse",
          series: null,
          distillery: ["Old Trestle"],
          category: "blend",
          stated_age: null,
          abv: 50,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
        candidates: [candidate],
      }),
    });

    expect(result).toMatchObject({
      action: "no_match",
      candidateBottleIds: [38004],
      matchedBottleId: null,
      proposedBottle: null,
      confidenceBasis: {
        unresolvedRisks: [
          {
            category: "trait_conflict",
            note: "candidate has a release year and lacks optional ABV",
          },
        ],
      },
    });
  });

  test("does not resolve a complete edition create draft to a partial-edition Bottle", () => {
    const candidate: BottleCandidate = {
      bottleId: 43397,
      alias: null,
      fullName: "High West A Midwinter Night's Dram",
      brand: "High West",
      bottler: null,
      series: "A Midwinter Night's Dram",
      distillery: [],
      category: "rye",
      statedAge: null,
      edition: "Act 12",
      caskStrength: null,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: 49.3,
      vintageYear: null,
      releaseYear: 2024,
      score: 1,
      source: ["exact"],
    };
    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "High West A Midwinter Night's Dram Act 12 Scene 9",
      },
      decision: {
        action: "create_bottle",
        rationale: "The label identifies the complete Scene 9 edition.",
        candidateBottleIds: [candidate.bottleId],
        identityScope: "product",
        observation: null,
        confidenceBasis: {
          positiveEvidence: ["readable complete edition marker"],
          unresolvedRisks: [],
          webEvidence: "not_needed",
        },
        matchedBottleId: null,
        proposedBottle: {
          name: "A Midwinter Night's Dram",
          series: { id: null, name: "A Midwinter Night's Dram" },
          category: "rye",
          edition: "Act 12 Scene 9",
          statedAge: null,
          caskStrength: null,
          singleCask: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          abv: 49.3,
          vintageYear: null,
          releaseYear: null,
          brand: { id: null, name: "High West" },
          distillers: [],
          bottler: null,
        },
      },
      artifacts: buildBottleClassificationArtifacts({
        extractedIdentity: {
          brand: "High West",
          bottler: null,
          expression: "A Midwinter Night's Dram",
          series: "A Midwinter Night's Dram",
          distillery: [],
          category: "rye",
          stated_age: null,
          abv: 49.3,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: "Act 12 Scene 9",
        },
        candidates: [candidate],
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "A Midwinter Night's Dram",
        edition: "Act 12 Scene 9",
      },
    });
  });

  test("defaults missing alias metadata to no alias", () => {
    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Example Private Cask",
      },
      decision: {
        action: "match",
        rationale: "The existing candidate matches.",
        candidateBottleIds: [existingPrivateCask.bottleId],
        identityScope: "product",
        observation: null,
        matchedBottleId: existingPrivateCask.bottleId,
        proposedBottle: null,
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [existingPrivateCask],
      }),
    });

    expect(result).toMatchObject({
      action: "match",
      aliasScope: "none",
    });
  });

  test("preserves alias metadata from the reviewed agent decision", () => {
    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Example Known Bottle",
        url: "https://shop.example.test/product/abc123",
      },
      decision: {
        action: "match",
        rationale: "The listing title is safe as a reusable alias.",
        candidateBottleIds: [existingPrivateCask.bottleId],
        identityScope: "product",
        aliasScope: "global_alias",
        observation: null,
        matchedBottleId: existingPrivateCask.bottleId,
        proposedBottle: null,
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [existingPrivateCask],
      }),
    });

    expect(result).toMatchObject({
      action: "match",
      aliasScope: "global_alias",
    });
  });

  test("restores source-marketed bottle age in the display name", () => {
    const result = classifyShieldaigAgeCreation(
      buildShieldaigAgeCreationDecision("Speyside"),
    );

    expect(result).toMatchObject({
      action: "create_bottle",
      matchedBottleId: null,
      proposedBottle: {
        name: "Speyside 30-year-old",
        statedAge: 30,
      },
    });
  });

  test("restores source-marketed bottle age without sibling conflict evidence", () => {
    const result = classifyAgeCreationWithoutSiblingConflict(
      buildShieldaigAgeCreationDecision("Speyside"),
    );

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Speyside 30-year-old",
        statedAge: 30,
      },
    });
  });

  test("keeps a reviewed web-supported age selected by the model", () => {
    const decision = buildShieldaigAgeCreationDecision("13.1 5-year-old");
    const result = finalizeBottleReferenceClassification({
      reference: { name: "Octomore 13.1" },
      decision: {
        ...decision,
        rationale:
          "Reviewed producer evidence identifies Octomore 13.1 as five years old.",
        confidenceBasis: {
          positiveEvidence: ["producer product page states five years old"],
          unresolvedRisks: [],
          webEvidence: "supportive",
        },
        proposedBottle: {
          ...decision.proposedBottle!,
          name: "13.1 5-year-old",
          statedAge: 5,
          brand: { id: null, name: "Octomore" },
        },
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [],
        searchEvidence: [
          {
            provider: "openai",
            query: "Octomore 13.1 age official",
            summary:
              "The producer page describes Octomore 13.1 as aged five years.",
            results: [],
          },
        ],
        extractedIdentity: {
          brand: "Octomore",
          bottler: null,
          expression: "13.1",
          series: null,
          distillery: ["Bruichladdich"],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "13.1 5-year-old",
        statedAge: 5,
      },
    });
  });

  test("keeps bottle creation when bottle-level age is present in display name", () => {
    const result = classifyShieldaigAgeCreation(
      buildShieldaigAgeCreationDecision("Speyside 30-year-old"),
    );

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Speyside 30-year-old",
        statedAge: 30,
      },
    });
  });

  test("rejects bottle creation when the expression duplicates the brand", () => {
    const result = classifyShieldaigAgeCreation(
      buildShieldaigAgeCreationDecision("Shieldaig"),
    );

    expect(result).toMatchObject({
      action: "no_match",
      proposedBottle: null,
    });
    expect(result.rationale).toContain(
      "proposed bottle name duplicates the brand",
    );
  });

  test("keeps bottle creation when bottle-level age is displayed as a word-age name", () => {
    const decision = buildShieldaigAgeCreationDecision("Speyside Thirty");
    if (!decision.proposedBottle) {
      throw new Error("Expected a proposed bottle draft");
    }
    decision.proposedBottle = {
      ...decision.proposedBottle,
      name: "Speyside Twenty One",
      statedAge: 21,
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Shieldaig Speyside 21-year-old Scotch Whisky",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [ageBearingCandidate, shieldaigSiblingAgeCandidate],
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
          cask_strength: null,
          single_cask: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Speyside Twenty One",
        statedAge: 21,
      },
    });
  });

  test("does not let generic cask details bypass duplicate product creation checks", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_bottle",
      rationale:
        "The source appears to describe a private cask product, but not a separate exact-cask bottle identity.",
      candidateBottleIds: [existingPrivateCask.bottleId],
      identityScope: null,
      observation: {
        caskNumber: "123",
        barrelNumber: null,
        bottleNumber: null,
        selector: null,
      },
      matchedBottleId: null,
      proposedBottle: {
        name: "Private Cask",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: null,
        caskStrength: null,
        singleCask: true,
        caskType: null,
        caskSize: null,
        caskFill: null,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        brand: {
          id: null,
          name: "Example",
        },
        distillers: [],
        bottler: null,
      },
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Example Private Cask No. 123",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        candidates: [existingPrivateCask],
      }),
    });

    expect(result).toMatchObject({
      action: "no_match",
      identityScope: "product",
      candidateBottleIds: [existingPrivateCask.bottleId],
      matchedBottleId: null,
      proposedBottle: null,
    });
    expect(result.rationale).toContain(
      "exact existing Bottle candidate may already cover",
    );
  });

  test("does not resolve exact-cask creation to a wrong-family code match", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_bottle",
      rationale:
        "The source and web evidence support an exact-cask bottle for Example.",
      candidateBottleIds: [wrongFamilyExactCodeCandidate.bottleId],
      identityScope: "exact_cask",
      observation: {
        caskNumber: "12.1",
        barrelNumber: null,
        bottleNumber: null,
        selector: null,
      },
      matchedBottleId: null,
      proposedBottle: {
        name: "Private Cask No. 12.1",
        series: null,
        category: "single_malt",
        edition: null,
        statedAge: null,
        caskStrength: null,
        singleCask: true,
        caskType: null,
        caskSize: null,
        caskFill: null,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        brand: {
          id: null,
          name: "Example",
        },
        distillers: [],
        bottler: null,
      },
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
          cask_strength: null,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      matchedBottleId: null,
    });
  });

  test("does not block exact-cask creation for a containment-only candidate name", () => {
    const containmentCandidate: BottleCandidate = {
      ...existingPrivateCask,
      bottleId: 102,
      alias: "Example Private Cask No. 12.1 Reserve",
      fullName: "Example Private Cask No. 12.1 Reserve",
    };
    const result = finalizeBottleReferenceClassification({
      reference: { name: "Example Private Cask No. 12.1" },
      decision: {
        action: "create_bottle",
        rationale: "The label supports an exact-cask Bottle.",
        candidateBottleIds: [containmentCandidate.bottleId],
        identityScope: "exact_cask",
        observation: {
          caskNumber: "12.1",
          barrelNumber: null,
          bottleNumber: null,
          selector: null,
        },
        matchedBottleId: null,
        proposedBottle: {
          name: "Private Cask No. 12.1",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: true,
          caskType: null,
          caskSize: null,
          caskFill: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          brand: { id: null, name: "Example" },
          distillers: [],
          bottler: null,
        },
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [containmentCandidate],
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
          cask_strength: null,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      proposedBottle: { name: "Private Cask No. 12.1" },
    });
  });

  test("conservatively downgrades a structural exact-cask duplicate with its risk evidence", () => {
    const exactCandidate: BottleCandidate = {
      ...existingPrivateCask,
      bottleId: 102,
      alias: "Example Private Cask No. 12.1",
      fullName: "Example Private Cask No. 12.1",
    };
    const unresolvedRisk = {
      category: "identity_ambiguity" as const,
      note: "the agent did not select the surfaced exact-code candidate",
    };
    const result = finalizeBottleReferenceClassification({
      reference: { name: "Example Private Cask No. 12.1" },
      decision: {
        action: "create_bottle",
        rationale: "The label supports an exact-cask Bottle.",
        candidateBottleIds: [exactCandidate.bottleId],
        identityScope: "exact_cask",
        observation: {
          caskNumber: "12.1",
          barrelNumber: null,
          bottleNumber: null,
          selector: null,
        },
        confidenceBasis: {
          positiveEvidence: ["readable exact cask code"],
          unresolvedRisks: [unresolvedRisk],
          webEvidence: "not_needed",
        },
        matchedBottleId: null,
        proposedBottle: {
          name: "Private Cask No. 12.1",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: true,
          caskType: null,
          caskSize: null,
          caskFill: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          brand: { id: null, name: "Example" },
          distillers: [],
          bottler: null,
        },
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [exactCandidate],
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
          cask_strength: null,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
      }),
    });

    expect(result).toMatchObject({
      action: "no_match",
      identityScope: "exact_cask",
      candidateBottleIds: [exactCandidate.bottleId],
      matchedBottleId: null,
      proposedBottle: null,
      confidenceBasis: { unresolvedRisks: [unresolvedRisk] },
    });
    expect(result.rationale).toContain(
      "reviewed action must select that Bottle explicitly",
    );
  });

  test("lets readable image evidence anchor exact-cask bottle creation automation", () => {
    const decision: BottleClassifierAgentDecisionInput = {
      action: "create_bottle",
      rationale:
        "The readable label identifies an exact single-cask bottle with no safe local match.",
      candidateBottleIds: [],
      identityScope: "exact_cask",
      aliasScope: "none",
      observation: {
        selector: null,
        caskNumber: "4779",
        barrelNumber: "4779",
        bottleNumber: null,
      },
      confidenceBasis: {
        positiveEvidence: ["Readable bottle label states barrel 4779."],
        unresolvedRisks: [],
        webEvidence: "not_needed",
      },
      matchedBottleId: null,
      proposedBottle: {
        name: "Single Barrel Barrel No. 4779 5-year-old",
        brand: {
          name: "Example",
        },
        bottler: null,
        distillers: [
          {
            name: "Example",
          },
        ],
        series: null,
        category: "bourbon",
        statedAge: 5,
        abv: 64.2,
        caskStrength: true,
        singleCask: true,
        caskType: null,
        caskSize: null,
        caskFill: null,
        vintageYear: null,
        releaseYear: null,
        edition: "Barrel No. 4779",
      },
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Example Single Barrel Barrel No. 4779",
      },
      decision,
      artifacts: buildBottleClassificationArtifacts({
        extractedIdentity: {
          brand: "Example",
          bottler: null,
          expression: "Single Barrel",
          series: null,
          distillery: ["Example"],
          category: "bourbon",
          stated_age: 5,
          abv: 64.2,
          release_year: null,
          vintage_year: null,
          cask_strength: true,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: "Barrel No. 4779",
        },
        imageEvidence: {
          sourceImageId: "example-barrel-4779",
          extractors: [
            {
              kind: "ocr",
              confidence: 0.98,
              textSpans: [
                {
                  text: "Example Single Barrel. Barrel No. 4779. 64.2% ABV.",
                  confidence: 0.98,
                },
              ],
              observations: [
                "The label identifies barrel no. 4779 as the bottle identity.",
              ],
            },
          ],
          fieldCandidates: {
            brand: {
              value: "Example",
              confidence: 0.98,
              sourceExtractorIndexes: [0],
            },
            expression: {
              value: "Single Barrel",
              confidence: 0.98,
              sourceExtractorIndexes: [0],
            },
            caskNumber: {
              value: "4779",
              confidence: 0.98,
              sourceExtractorIndexes: [0],
            },
          },
          photoSuitability: {
            isSingleBottlePhoto: true,
            labelReadable: true,
            suitableAsTastingImage: true,
            suitableAsBottleImage: true,
          },
          conflicts: [],
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
    });
  });

  test("does not suppress brand conflicts for non-SMWS targets with an SMWS-style code", () => {
    const targetCandidate: BottleCandidate = {
      bottleId: 11940,
      alias: "Other Bottler 95.71 Winter Release",
      fullName: "Other Bottler 95.71 Winter Release",
      brand: "Other Bottler",
      bottler: "Other Bottler",
      series: null,
      distillery: [],
      category: "single_malt",
      statedAge: 14,
      edition: null,
      caskStrength: null,
      singleCask: true,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      score: 0.9,
      source: ["text"],
    };

    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "SMWS 95.71 Prepare for Winter",
      },
      decision: {
        action: "match",
        rationale: "The source appears to match the coded candidate.",
        candidateBottleIds: [targetCandidate.bottleId],
        identityScope: "exact_cask",
        aliasScope: "none",
        observation: {
          selector: null,
          caskNumber: "95.71",
          barrelNumber: null,
          bottleNumber: null,
        },
        confidenceBasis: {
          positiveEvidence: ["The source uses cask code 95.71."],
          unresolvedRisks: [],
          webEvidence: "not_needed",
        },
        matchedBottleId: targetCandidate.bottleId,
        proposedBottle: null,
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [targetCandidate],
        extractedIdentity: {
          brand: "SMWS",
          bottler: "The Scotch Malt Whisky Society",
          expression: "95.71 Prepare for Winter",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: 14,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
      }),
    });

    expect(result).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
    });
  });

  test("rejects a match that conflicts with the current Bottle identity", () => {
    const targetCandidate: BottleCandidate = {
      ...existingPrivateCask,
      bottleId: 9900,
      fullName: "Spice Tree Extravaganza CB Limited Edition",
      brand: "Spice Tree",
      bottler: "Compass Box",
      category: "single_malt",
      statedAge: 3,
      singleCask: null,
    };
    const decision: BottleClassifierAgentDecisionInput = {
      action: "match",
      rationale: "The distinctive marketed product matches the malformed row.",
      candidateBottleIds: [9900],
      identityScope: "product",
      aliasScope: "none",
      observation: null,
      matchedBottleId: 9900,
      proposedBottle: null,
    };
    const artifacts = buildBottleClassificationArtifacts({
      candidates: [targetCandidate],
      extractedIdentity: {
        brand: "Compass Box",
        bottler: "Compass Box",
        expression: "Spice Tree Extravaganza",
        series: null,
        distillery: [],
        category: null,
        stated_age: null,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: "Limited Edition",
      },
    });

    expect(
      finalizeBottleReferenceClassification({
        reference: { name: "Compass Box Spice Tree Extravaganza" },
        decision,
        artifacts,
      }),
    ).toMatchObject({ action: "no_match", matchedBottleId: null });
  });

  test("keeps the extracted SMWS title in exact-cask create proposals", () => {
    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Bottle photo upload",
      },
      decision: {
        action: "no_match",
        rationale: "No local bottle matched the readable SMWS label.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [],
        extractedIdentity: {
          brand: "SMWS",
          bottler: "The Scotch Malt Whisky Society",
          expression: "Prepare for Winter",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: 14,
          abv: 57,
          release_year: null,
          vintage_year: 2007,
          cask_strength: true,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: "95.71",
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      proposedBottle: {
        name: "95.71 Prepare for Winter",
        edition: null,
        statedAge: 14,
        abv: 57,
        vintageYear: 2007,
      },
    });
  });

  test("does not append SMWS age and vintage to agent exact-cask proposal names", () => {
    const result = finalizeBottleReferenceClassification({
      reference: {
        name: "Bottle photo upload",
      },
      decision: {
        action: "create_bottle",
        rationale: "The readable SMWS label identifies an exact-cask bottle.",
        candidateBottleIds: [],
        identityScope: "exact_cask",
        observation: {
          selector: null,
          caskNumber: "95.71",
          barrelNumber: null,
          bottleNumber: null,
        },
        matchedBottleId: null,
        proposedBottle: {
          name: "95.71 Prepare for Winter",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 14,
          caskStrength: true,
          singleCask: true,
          caskType: null,
          caskSize: null,
          caskFill: null,
          abv: 57,
          vintageYear: 2007,
          releaseYear: null,
          brand: {
            id: null,
            name: "SMWS",
          },
          distillers: [],
          bottler: {
            id: null,
            name: "The Scotch Malt Whisky Society",
          },
        },
      },
      artifacts: buildBottleClassificationArtifacts({
        candidates: [],
        extractedIdentity: {
          brand: "SMWS",
          bottler: "The Scotch Malt Whisky Society",
          expression: "Prepare for Winter",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: 14,
          abv: 57,
          release_year: null,
          vintage_year: 2007,
          cask_strength: true,
          single_cask: true,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: "95.71",
        },
      }),
    });

    expect(result).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      proposedBottle: {
        name: "95.71 Prepare for Winter",
        statedAge: 14,
        abv: 57,
        vintageYear: 2007,
      },
    });
  });
});
