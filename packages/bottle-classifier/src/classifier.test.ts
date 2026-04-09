import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";
import {
  createBottleClassifier,
  type RunBottleClassifierAgentInput,
} from "./classifier";
import type { BottleClassificationArtifacts } from "./contract";
import type {
  BottleCandidate,
  BottleClassifierAgentDecision,
  BottleExtractedDetails,
} from "./schemas";

type ReasoningResult = {
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
};

function createTestClassifier({
  extractedIdentity = null,
  extractedIdentityFromImage,
  extractedIdentityFromText,
  extractFromImageError,
  searchBottles = vi.fn(async () => [] as BottleCandidate[]),
  runBottleClassifierAgent,
}: {
  extractedIdentity?: BottleExtractedDetails | null;
  extractedIdentityFromImage?: BottleExtractedDetails | null;
  extractedIdentityFromText?: BottleExtractedDetails | null;
  extractFromImageError?: Error | null;
  searchBottles?: ReturnType<
    typeof vi.fn<(args: unknown) => Promise<BottleCandidate[]>>
  >;
  runBottleClassifierAgent?: (
    args: RunBottleClassifierAgentInput,
  ) => Promise<ReasoningResult>;
}) {
  return {
    classifier: createBottleClassifier({
      client: {} as OpenAI,
      model: "test-model",
      maxSearchQueries: 2,
      adapters: {
        searchBottles,
      },
      overrides: {
        extractFromImage: async () => {
          if (extractFromImageError) {
            throw extractFromImageError;
          }
          return extractedIdentityFromImage ?? extractedIdentity;
        },
        extractFromText: async () =>
          extractedIdentityFromText ?? extractedIdentity,
        runBottleClassifierAgent,
      },
    }),
    searchBottles,
  };
}

const wildTurkeyRareBreedRyeIdentity: BottleExtractedDetails = {
  brand: "Wild Turkey",
  bottler: null,
  expression: "Rare Breed Rye",
  series: null,
  distillery: [],
  category: "rye",
  stated_age: null,
  abv: null,
  release_year: null,
  vintage_year: null,
  cask_type: null,
  cask_size: null,
  cask_fill: null,
  cask_strength: null,
  single_cask: null,
  edition: null,
};

const rareBreedNearMatch: BottleCandidate = {
  bottleId: 7,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Wild Turkey Rare Breed Barrel Proof",
  bottleFullName: "Wild Turkey Rare Breed Barrel Proof",
  brand: "Wild Turkey",
  bottler: null,
  series: null,
  distillery: [],
  category: "rye",
  statedAge: null,
  edition: null,
  caskStrength: true,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.6,
  source: ["vector"],
};

const elijahCraigBarrelProofCandidate: BottleCandidate = {
  bottleId: 620,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Elijah Craig Barrel Proof",
  bottleFullName: "Elijah Craig Barrel Proof",
  brand: "Elijah Craig",
  bottler: null,
  series: null,
  distillery: ["Heaven Hill"],
  category: "bourbon",
  statedAge: 12,
  edition: null,
  caskStrength: true,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.94,
  source: ["exact"],
};

const glenglassaughRareCaskParentCandidate: BottleCandidate = {
  bottleId: 2457,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Glenglassaugh 1978 Rare Cask Release",
  bottleFullName: "Glenglassaugh 1978 Rare Cask Release",
  brand: "Glenglassaugh",
  bottler: null,
  series: null,
  distillery: ["Glenglassaugh"],
  category: "single_malt",
  statedAge: 40,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.95,
  source: ["exact"],
};

const taleOfIceCreamCandidate: BottleCandidate = {
  bottleId: 43236,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Glenmorangie A Tale of Ice Cream",
  bottleFullName: "Glenmorangie A Tale of Ice Cream",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
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
  score: 0.9,
  source: ["text"],
};

const springbank10YearOldCandidate: BottleCandidate = {
  bottleId: 11,
  releaseId: null,
  kind: "bottle",
  alias: "Springbank 10-year-old",
  fullName: "Springbank 10-year-old",
  bottleFullName: "Springbank 10-year-old",
  brand: "Springbank",
  bottler: null,
  series: null,
  distillery: ["Springbank"],
  category: "single_malt",
  statedAge: 10,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: 46,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.99,
  source: ["exact"],
};

const cadbollEstateParentCandidate: BottleCandidate = {
  bottleId: 13442,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Glenmorangie 15-year-old The Cadboll Estate",
  bottleFullName: "Glenmorangie 15-year-old The Cadboll Estate",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.92,
  source: ["text"],
};

const cadbollEstateLegacyBatch4Candidate: BottleCandidate = {
  bottleId: 43034,
  releaseId: null,
  kind: "bottle",
  alias: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
  fullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
  bottleFullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
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

const cadbollEstateLegacyBatch2Candidate: BottleCandidate = {
  bottleId: 12900,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 2)",
  bottleFullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 2)",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.87,
  source: ["text"],
};

describe("createBottleClassifier", () => {
  test("auto ignores obvious non-whisky references when extraction fails", async () => {
    const runBottleClassifierAgent = vi.fn();
    const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      searchBottles,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Tito's Handmade Vodka",
      },
    });

    expect(result).toMatchObject({
      status: "ignored",
      artifacts: {
        extractedIdentity: null,
      },
    });
    expect(searchBottles).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("auto ignores packaging-only gift set references when extraction fails", async () => {
    const runBottleClassifierAgent = vi.fn();
    const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      searchBottles,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Unknown Bottle Gift Set with 2 Glasses",
      },
    });

    expect(result).toMatchObject({
      status: "ignored",
      artifacts: {
        extractedIdentity: null,
      },
    });
    expect(searchBottles).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("falls back to text extraction when image extraction returns null", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({ extractedIdentity }): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          confidence: 88,
          rationale: "Used the text fallback.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Springbank 10 Year Old",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 10,
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: extractedIdentity?.brand ?? "Springbank",
            },
            distillers: [
              {
                id: null,
                name: "Springbank",
              },
            ],
            bottler: null,
          },
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity: extractedIdentity ?? null,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentityFromImage: null,
      extractedIdentityFromText: {
        brand: "Springbank",
        bottler: null,
        expression: "10 Year Old",
        series: null,
        distillery: ["Springbank"],
        category: "single_malt",
        stated_age: 10,
        abv: 46,
        release_year: null,
        vintage_year: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        cask_strength: null,
        single_cask: null,
        edition: null,
      },
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "springbank 10 yo",
        imageUrl: "https://example.com/springbank.png",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.artifacts.extractedIdentity).toMatchObject({
      brand: "Springbank",
      stated_age: 10,
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledOnce();
  });

  test("falls back to text extraction when image extraction throws", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({ extractedIdentity }): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          confidence: 70,
          rationale: "Image failed, text fallback still ran.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity: extractedIdentity ?? null,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentityFromText: {
        brand: "Ardbeg",
        bottler: null,
        expression: "Uigeadail",
        series: null,
        distillery: ["Ardbeg"],
        category: "single_malt",
        stated_age: null,
        abv: 54.2,
        release_year: null,
        vintage_year: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        cask_strength: null,
        single_cask: null,
        edition: null,
      },
      extractFromImageError: new Error("image fetch failed"),
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Ardbeg Uigeadail Single Malt Scotch Whisky 750ml",
        imageUrl: "https://example.com/ardbeg.png",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.artifacts.extractedIdentity).toMatchObject({
      brand: "Ardbeg",
      expression: "Uigeadail",
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledOnce();
  });

  test("downgrades unsupported non-exact existing matches inside the classifier", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 82,
          rationale: "Closest local candidate.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 7,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [7],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity: wildTurkeyRareBreedRyeIdentity,
          searchEvidence: [],
          candidates: initialCandidates,
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: wildTurkeyRareBreedRyeIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Wild Turkey Rare Breed Rye",
        url: "https://example.com/products/rare-breed-rye",
      },
      extractedIdentity: wildTurkeyRareBreedRyeIdentity,
      initialCandidates: [rareBreedNearMatch],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
    });
  });

  test("promotes a bottle match into create_release when extracted identity includes batch-level detail", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Elijah Craig",
      bottler: null,
      expression: "Barrel Proof",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: null,
      edition: "Batch C923",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 95,
          rationale: "The parent bottle identity is exact.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 620,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [620],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [elijahCraigBarrelProofCandidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Elijah Craig Barrel Proof Batch C923",
      },
      extractedIdentity,
      initialCandidates: [elijahCraigBarrelProofCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_release",
      parentBottleId: 620,
      identityScope: "product",
      proposedRelease: {
        edition: "Batch C923",
      },
    });
  });

  test("promotes a dirty parent age match into create_release with the differing release age", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Glenglassaugh",
      bottler: null,
      expression: "1978 Rare Cask Release",
      series: null,
      distillery: ["Glenglassaugh"],
      category: "single_malt",
      stated_age: 35,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 1",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 95,
          rationale: "The parent bottle identity is exact.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 2457,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [2457],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [glenglassaughRareCaskParentCandidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Glenglassaugh 1978 Rare Cask Release (Batch 1) 35-year-old",
      },
      extractedIdentity,
      initialCandidates: [glenglassaughRareCaskParentCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_release",
      parentBottleId: 2457,
      identityScope: "product",
      proposedRelease: {
        edition: "Batch 1",
        statedAge: 35,
      },
    });
  });

  test("does not fabricate a release from an exact marketed-age bottle match with a noisy extracted age", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Springbank",
      bottler: null,
      expression: "10 Year Old",
      series: null,
      distillery: ["Springbank"],
      category: "single_malt",
      stated_age: 12,
      abv: 46,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 94,
          rationale: "The local alias is an exact wording match.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 11,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [11],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [springbank10YearOldCandidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Springbank 10-year-old",
      },
      extractedIdentity,
      initialCandidates: [springbank10YearOldCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 11,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.proposedRelease).toBeNull();
  });

  test("keeps a strong local bottle match when the retailer title only differs by a standalone article and generic style words", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Glenmorangie",
      bottler: null,
      expression: "Tale of Ice Cream",
      series: null,
      distillery: ["Glenmorangie"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 89,
          rationale: "The local bottle identity matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 43236,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [43236],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [taleOfIceCreamCandidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Glenmorangie Tale of Ice Cream Single Malt Scotch Whisky",
      },
      extractedIdentity,
      initialCandidates: [taleOfIceCreamCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 43236,
      matchedReleaseId: null,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("redirects an exact legacy batch bottle match to a reusable parent bottle", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Glenmorangie",
      bottler: null,
      expression: "The Cadboll Estate",
      series: null,
      distillery: ["Glenmorangie"],
      category: "single_malt",
      stated_age: 15,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 4",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 96,
          rationale:
            "The title exactly matches the existing local candidate alias.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 43034,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [43034, 13442, 12900],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            cadbollEstateLegacyBatch4Candidate,
            cadbollEstateParentCandidate,
            cadbollEstateLegacyBatch2Candidate,
          ],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
      },
      extractedIdentity,
      initialCandidates: [
        cadbollEstateLegacyBatch4Candidate,
        cadbollEstateParentCandidate,
        cadbollEstateLegacyBatch2Candidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_release",
      parentBottleId: 13442,
      identityScope: "product",
      proposedRelease: {
        edition: "Batch 4",
      },
    });
    expect(result.decision.rationale).toContain(
      "legacy release-like bottle candidate",
    );
  });

  test("does not create a child release under a legacy batch bottle when no reusable parent exists", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Glenmorangie",
      bottler: null,
      expression: "The Cadboll Estate",
      series: null,
      distillery: ["Glenmorangie"],
      category: "single_malt",
      stated_age: 15,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 4",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 96,
          rationale:
            "The title exactly matches the existing local candidate alias.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 43034,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [43034],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [cadbollEstateLegacyBatch4Candidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
      },
      extractedIdentity,
      initialCandidates: [cadbollEstateLegacyBatch4Candidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 43034,
      matchedReleaseId: null,
    });
  });

  test("infers exact_cask identity scope for single-cask bottle creation", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "The Scotch Malt Whisky Society",
      bottler: null,
      expression: "6.71",
      series: null,
      distillery: ["Macduff"],
      category: "single_malt",
      stated_age: null,
      abv: 61.2,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: true,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          confidence: 96,
          rationale: "This is marketed as a standalone single-cask bottle.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "6.71",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: true,
            abv: 61.2,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "The Scotch Malt Whisky Society",
            },
            distillers: [
              {
                id: null,
                name: "Macduff",
              },
            ],
            bottler: null,
          },
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "SMWS 6.71",
      },
      extractedIdentity,
      initialCandidates: [],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
    });
  });

  test("keeps generic single-barrel bottles in product scope without exact-cask identity signals", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Four Roses",
      bottler: null,
      expression: "Single Barrel",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: null,
      abv: 50,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: true,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          confidence: 91,
          rationale:
            "This is a bottle-level product, but the reference does not identify a specific cask.",
          candidateBottleIds: [],
          identityScope: "exact_cask",
          observation: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Single Barrel",
            series: null,
            category: "bourbon",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: true,
            abv: 50,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "Four Roses",
            },
            distillers: [],
            bottler: null,
          },
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Four Roses Single Barrel",
      },
      extractedIdentity,
      initialCandidates: [],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_bottle",
      identityScope: "product",
    });
  });

  test("keeps dotted ABV-style numbers in product scope outside known exact-cask programs", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Example",
      bottler: null,
      expression: "Single Barrel 58.4",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: null,
      abv: 58.4,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: true,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          confidence: 89,
          rationale:
            "This is a barrel-strength single-barrel bourbon, not a numbered exact-cask program bottle.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Example Single Barrel 58.4",
            series: null,
            category: "bourbon",
            edition: null,
            statedAge: null,
            caskStrength: true,
            singleCask: true,
            abv: 58.4,
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
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Example Single Barrel 58.4",
      },
      extractedIdentity,
      initialCandidates: [],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_bottle",
      identityScope: "product",
    });
  });

  test("collapses exact-cask bottle-and-release creation into exact-cask bottle creation", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "The Scotch Malt Whisky Society",
      bottler: "The Scotch Malt Whisky Society",
      expression: "RW6.5 Sauna Smoke",
      series: null,
      distillery: ["Kyro"],
      category: "rye",
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
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle_and_release",
          confidence: 93,
          rationale:
            "The SMWS cask code identifies a distinct exact-cask bottle and web evidence also revealed release-like details.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: {
            selector: "Sauna Smoke",
            caskNumber: "RW6.5",
            barrelNumber: null,
            bottleNumber: null,
            outturn: 231,
            market: null,
            exclusive: null,
          },
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "RW6.5 Appley Ever After",
            series: null,
            category: "rye",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "The Scotch Malt Whisky Society",
            },
            distillers: [
              {
                id: null,
                name: "Kyro",
              },
            ],
            bottler: null,
          },
          proposedRelease: {
            edition: null,
            statedAge: 6,
            abv: 56,
            caskStrength: null,
            singleCask: true,
            vintageYear: 2018,
            releaseYear: 2025,
            caskType: "other",
            caskSize: "barrel",
            caskFill: "1st_fill",
            description: "Official SMWS outturn details.",
            tastingNotes: null,
            imageUrl: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
      },
      extractedIdentity,
      initialCandidates: [],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      proposedRelease: null,
      proposedBottle: {
        name: "RW6.5 Appley Ever After",
        statedAge: 6,
        abv: 56,
        singleCask: true,
        vintageYear: 2018,
        releaseYear: 2025,
        caskType: "other",
        caskSize: "barrel",
        caskFill: "1st_fill",
      },
      observation: {
        selector: "Sauna Smoke",
        caskNumber: "RW6.5",
        outturn: 231,
      },
    });
    expect(result.decision.rationale).toContain(
      "exact-cask identity cannot create a child release beneath the bottle",
    );
  });
});
