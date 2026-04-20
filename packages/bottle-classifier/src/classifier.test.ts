import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";
import {
  createBottleClassifier,
  type RunBottleClassifierAgentInput,
} from "./classifierRuntime";
import type {
  BottleCandidate,
  BottleClassifierAgentDecision,
  BottleExtractedDetails,
} from "./classifierTypes";
import type { BottleClassificationArtifacts } from "./contract";

type ReasoningResult = {
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
};

// Keep this file focused on deterministic classifier boundary behavior.
// Real-bottle workflow regressions belong in the fixture-driven eval corpus,
// not in additional mocked classifier behavior tests here.
function createTestClassifier({
  extractedIdentity = null,
  extractedIdentityFromImage,
  extractedIdentityFromText,
  extractFromImageError,
  searchBottles = vi.fn(async () => [] as BottleCandidate[]),
  getBottleCandidateById,
  runBottleClassifierAgent,
}: {
  extractedIdentity?: BottleExtractedDetails | null;
  extractedIdentityFromImage?: BottleExtractedDetails | null;
  extractedIdentityFromText?: BottleExtractedDetails | null;
  extractFromImageError?: Error | null;
  searchBottles?: ReturnType<
    typeof vi.fn<(args: unknown) => Promise<BottleCandidate[]>>
  >;
  getBottleCandidateById?: (
    bottleId: number,
    releaseId: number | null,
  ) => Promise<BottleCandidate | null>;
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
        getBottleCandidateById,
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

const buffaloTraceStraightBourbonIdentity: BottleExtractedDetails = {
  brand: "Buffalo Trace",
  bottler: null,
  expression: null,
  series: null,
  distillery: ["Buffalo Trace"],
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
  edition: null,
};

const blantonsOriginalIdentity: BottleExtractedDetails = {
  brand: "Blanton's",
  bottler: null,
  expression: "The Original Single Barrel Bourbon Whiskey",
  series: null,
  distillery: ["Buffalo Trace"],
  category: "bourbon",
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

const macallanSherryOakParentCandidate: BottleCandidate = {
  bottleId: 54082,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "The Macallan Sherry Oak",
  bottleFullName: "The Macallan Sherry Oak",
  brand: "The Macallan",
  bottler: null,
  series: null,
  distillery: [],
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

const macallanSherryOakLegacy30Candidate: BottleCandidate = {
  bottleId: 54083,
  releaseId: null,
  kind: "bottle",
  alias: "The Macallan Sherry Oak Single Malt Scotch 30-year-old",
  fullName: "The Macallan Sherry Oak 30-year-old",
  bottleFullName: "The Macallan Sherry Oak 30-year-old",
  brand: "The Macallan",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: 30,
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

const tomatinLegacy12Candidate: BottleCandidate = {
  bottleId: 65001,
  releaseId: null,
  kind: "bottle",
  alias: "Tomatin Single Malt 12-year-old",
  fullName: "Tomatin 12-year-old",
  bottleFullName: "Tomatin 12-year-old",
  brand: "Tomatin",
  bottler: null,
  series: null,
  distillery: ["Tomatin"],
  category: "single_malt",
  statedAge: 12,
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

const tomatinCaskStrengthParentCandidate: BottleCandidate = {
  bottleId: 65002,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Tomatin Cask Strength",
  bottleFullName: "Tomatin Cask Strength",
  brand: "Tomatin",
  bottler: null,
  series: null,
  distillery: ["Tomatin"],
  category: "single_malt",
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
  score: 0.82,
  source: ["text"],
};

const tomatinBourbonAndSherryCasksCandidate: BottleCandidate = {
  bottleId: 65003,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Tomatin 12-year-old Bourbon & Sherry Casks",
  bottleFullName: "Tomatin 12-year-old Bourbon & Sherry Casks",
  brand: "Tomatin",
  bottler: null,
  series: null,
  distillery: ["Tomatin"],
  category: "single_malt",
  statedAge: 12,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: 43,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.81,
  source: ["text"],
};

const penelopeBarrelStrengthParentCandidate: BottleCandidate = {
  bottleId: 54068,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey",
  bottleFullName: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey",
  brand: "Penelope",
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
  score: 0.89,
  source: ["text"],
};

const penelopeLegacyBatch11Candidate: BottleCandidate = {
  bottleId: 54069,
  releaseId: null,
  kind: "bottle",
  alias: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey Batch 11",
  fullName:
    "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey (Batch 11)",
  bottleFullName:
    "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey (Batch 11)",
  brand: "Penelope",
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
  score: 1,
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

const ledaigStiuireadairCandidate: BottleCandidate = {
  bottleId: 41258,
  releaseId: null,
  kind: "bottle",
  alias: "Ledaig Stiuireadair",
  fullName: "Ledaig Stiuireadair",
  bottleFullName: "Ledaig Stiuireadair",
  brand: "Ledaig",
  bottler: null,
  series: null,
  distillery: ["Tobermory"],
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
  score: 0.88,
  source: ["text"],
};

const ledaigStiuiredairNearDuplicateCandidate: BottleCandidate = {
  bottleId: 41259,
  releaseId: null,
  kind: "bottle",
  alias: "Ledaig Stiuiredair",
  fullName: "Ledaig Stiuiredair",
  bottleFullName: "Ledaig Stiuiredair",
  brand: "Ledaig",
  bottler: null,
  series: null,
  distillery: ["Tobermory"],
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
  score: 0.84,
  source: ["vector"],
};

const jura12YearOldCandidate: BottleCandidate = {
  bottleId: 3233,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
  bottleFullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
  brand: "Jura",
  bottler: null,
  series: null,
  distillery: ["Isle of Jura"],
  category: "single_malt",
  statedAge: 12,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.91,
  source: ["text"],
};

const juraElixirCandidate: BottleCandidate = {
  bottleId: 4306,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Jura Elixir",
  bottleFullName: "Jura Elixir",
  brand: "Jura",
  bottler: null,
  series: null,
  distillery: ["Isle of Jura"],
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
  score: 0.72,
  source: ["text"],
};

const juraSherryCaskCandidate: BottleCandidate = {
  bottleId: 3234,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Jura 12-year-old Sherry Cask Single Malt Scotch Whisky",
  bottleFullName: "Jura 12-year-old Sherry Cask Single Malt Scotch Whisky",
  brand: "Jura",
  bottler: null,
  series: null,
  distillery: ["Isle of Jura"],
  category: "single_malt",
  statedAge: 12,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: "oloroso",
  caskSize: null,
  caskFill: null,
  score: 0.88,
  source: ["text"],
};

const canadianClubReserve9YearOldCandidate: BottleCandidate = {
  bottleId: 16913,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Canadian Club Reserve 9-year-old Triple Aged",
  bottleFullName: "Canadian Club Reserve 9-year-old Triple Aged",
  brand: "Canadian",
  bottler: null,
  series: null,
  distillery: [],
  category: "blend",
  statedAge: 9,
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
  source: ["text"],
};

const canadianClubReserve40Candidate: BottleCandidate = {
  bottleId: 17346,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Canadian Club Reserve, 40% ABV",
  bottleFullName: "Canadian Club Reserve, 40% ABV",
  brand: "Canadian",
  bottler: null,
  series: null,
  distillery: [],
  category: "blend",
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
  score: 1,
  source: ["text"],
};

const redbreastBatchACandidate: BottleCandidate = {
  bottleId: 9101,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Redbreast Small Batch Cask Strength Batch A",
  bottleFullName: "Redbreast Small Batch Cask Strength Batch A",
  brand: "Redbreast",
  bottler: null,
  series: null,
  distillery: ["Midleton"],
  category: "single_pot_still",
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
  score: 0.83,
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

const glengoyneLegacySeriesChapterTwoCandidate: BottleCandidate = {
  bottleId: 2083,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Glengoyne The Legacy Series Chapter Two",
  bottleFullName: "Glengoyne The Legacy Series Chapter Two",
  brand: "Glengoyne",
  bottler: null,
  series: null,
  distillery: ["Glengoyne"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: 48,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.96,
  source: ["exact"],
};

const glengoyneLegacySeriesChapterOneCandidate: BottleCandidate = {
  bottleId: 2460,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Glengoyne The Legacy Series Chapter One",
  bottleFullName: "Glengoyne The Legacy Series Chapter One",
  brand: "Glengoyne",
  bottler: null,
  series: null,
  distillery: ["Glengoyne"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: 48,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.91,
  source: ["text"],
};

const cadbollEstateBatch4ReleaseCandidate: BottleCandidate = {
  bottleId: 13442,
  releaseId: 9102,
  kind: "release",
  alias: null,
  fullName: "Glenmorangie 15-year-old The Cadboll Estate - Batch 4",
  bottleFullName: "Glenmorangie 15-year-old The Cadboll Estate",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
  edition: "Batch 4",
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

const lagavulinDistillersEditionParentCandidate: BottleCandidate = {
  bottleId: 44006,
  releaseId: null,
  kind: "bottle",
  alias: null,
  fullName: "Lagavulin Distillers Edition",
  bottleFullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
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
  score: 0.91,
  source: ["text"],
};

const lagavulinDistillersEdition2023ReleaseCandidate: BottleCandidate = {
  bottleId: 44006,
  releaseId: 78,
  kind: "release",
  alias: null,
  fullName: "Lagavulin Distillers Edition 2023 Release",
  bottleFullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: 2023,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.95,
  source: ["text", "release"],
};

const lagavulinDistillersEdition2023SpringReleaseCandidate: BottleCandidate = {
  bottleId: 44006,
  releaseId: 79,
  kind: "release",
  alias: null,
  fullName: "Lagavulin Distillers Edition 2023 Spring Release",
  bottleFullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: "Spring Release",
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: 2023,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.94,
  source: ["text", "release"],
};

const lagavulinDistillersEdition2023AutumnReleaseCandidate: BottleCandidate = {
  bottleId: 44006,
  releaseId: 80,
  kind: "release",
  alias: null,
  fullName: "Lagavulin Distillers Edition 2023 Autumn Release",
  bottleFullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: "Autumn Release",
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: 2023,
  caskType: null,
  caskSize: null,
  caskFill: null,
  score: 0.93,
  source: ["text", "release"],
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

  test("auto ignores multi-pack listings even when extraction finds a bottle identity", async () => {
    const runBottleClassifierAgent = vi.fn();
    const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
    const { classifier } = createTestClassifier({
      extractedIdentity: buffaloTraceStraightBourbonIdentity,
      searchBottles,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Buffalo Trace Kentucky Straight Bourbon Whiskey 12 Pack",
      },
    });

    expect(result).toMatchObject({
      status: "ignored",
      reason:
        "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      artifacts: {
        extractedIdentity: buffaloTraceStraightBourbonIdentity,
      },
    });
    expect(searchBottles).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("auto ignores bundle listings even when extraction finds a bottle identity", async () => {
    const runBottleClassifierAgent = vi.fn();
    const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
    const { classifier } = createTestClassifier({
      extractedIdentity: buffaloTraceStraightBourbonIdentity,
      searchBottles,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Buffalo Trace Bourbon with Glencairn Set Cigar Bundle",
      },
    });

    expect(result).toMatchObject({
      status: "ignored",
      reason:
        "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      artifacts: {
        extractedIdentity: buffaloTraceStraightBourbonIdentity,
      },
    });
    expect(searchBottles).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("auto ignores damaged-condition listings even when extraction finds a bottle identity", async () => {
    const runBottleClassifierAgent = vi.fn();
    const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
    const { classifier } = createTestClassifier({
      extractedIdentity: blantonsOriginalIdentity,
      searchBottles,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Blanton's Bourbon Blooper Bottle - Broken Wax Seal (SEE DESCRIPTION)",
      },
    });

    expect(result).toMatchObject({
      status: "ignored",
      reason:
        "Reference describes a damaged or non-standard sale-condition bottle, not a standard bottle listing.",
      artifacts: {
        extractedIdentity: blantonsOriginalIdentity,
      },
    });
    expect(searchBottles).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("forwards closed-set candidate expansion to the reasoning pass", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({
        candidateExpansion,
      }: RunBottleClassifierAgentInput): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          confidence: 82,
          rationale: "Closed-set review could not reuse a parent bottle.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
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
              name: "Festival Distillery",
            },
            distillers: [],
            bottler: null,
          },
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity: null,
          candidates: [],
          searchEvidence: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      runBottleClassifierAgent,
    });

    await classifier.classifyBottleReference({
      reference: {
        name: "Warehouse Session (Batch 2)",
      },
      candidateExpansion: "initial_only",
    });

    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateExpansion: "initial_only",
      }),
    );
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

  test("does not invent a branded bottle from sparse generic batch wording", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle_and_release",
          confidence: 80,
          rationale:
            "Web evidence suggests Johnnie Walker Blenders' Batch Sherry Cask Finish EXP#7.",
          identityScope: "product",
          observation: {
            selector: "Batch Sherry",
            caskNumber: null,
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: "travel-retail",
            exclusive: "travel-retail",
          },
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Blenders' Sherry Cask Finish",
            series: {
              id: null,
              name: "Blenders' Batch",
            },
            category: "blend",
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
              name: "Johnnie Walker",
            },
            distillers: [],
            bottler: null,
          },
          proposedRelease: {
            edition: "EXP#7",
            statedAge: 12,
            abv: 40,
            caskStrength: false,
            singleCask: false,
            vintageYear: null,
            releaseYear: 2018,
            caskType: "other",
            caskSize: null,
            caskFill: null,
            description: "Sherry cask finish travel-retail release.",
            tastingNotes: null,
            imageUrl: null,
          },
        },
        artifacts: {
          extractedIdentity: null,
          searchEvidence: [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Batch Sherry",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.rationale).toContain(
      "expanded too far beyond a sparse unanchored reference",
    );
  });

  test("keeps a matched bottle when the only name difference is a canonical proof suffix", async () => {
    const rareBreedRyeMatch: BottleCandidate = {
      bottleId: 501,
      releaseId: null,
      kind: "bottle",
      alias: null,
      fullName: "Wild Turkey Rare Breed Rye Barrel Proof",
      bottleFullName: "Wild Turkey Rare Breed Rye Barrel Proof",
      brand: "Wild Turkey",
      bottler: null,
      series: "Rare Breed",
      distillery: [],
      category: "rye",
      statedAge: null,
      edition: null,
      caskStrength: true,
      singleCask: null,
      abv: 56.1,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      score: 0.93,
      source: ["text"],
    };
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 90,
          rationale: "Recovered the exact Rare Breed Rye bottle.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 501,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [501],
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
      initialCandidates: [rareBreedRyeMatch],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 501,
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

  test("promotes a parent bottle match into a richer create_release even when an unrelated child release already exists", async () => {
    const heritageCaskStrengthParentCandidate: BottleCandidate = {
      bottleId: 99001,
      releaseId: null,
      kind: "bottle",
      alias: null,
      fullName: "Heritage Cask Strength",
      bottleFullName: "Heritage Cask Strength",
      brand: "Example Distillery",
      bottler: null,
      series: null,
      distillery: ["Example Distillery"],
      category: "single_malt",
      statedAge: 12,
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
    const heritageCaskStrengthBatch1Candidate: BottleCandidate = {
      ...heritageCaskStrengthParentCandidate,
      releaseId: 88001,
      kind: "release",
      fullName: "Heritage Cask Strength - Batch 1",
      edition: "Batch 1",
      abv: 56.8,
      caskStrength: true,
      releaseYear: 2023,
      caskType: "bourbon",
      score: 0.82,
      source: ["text"],
    };
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Example Distillery",
      bottler: null,
      expression: "Heritage Cask Strength",
      series: null,
      distillery: ["Example Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: 58.2,
      release_year: 2024,
      vintage_year: null,
      cask_type: "oloroso",
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: null,
      edition: "Batch 2",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 94,
          rationale: "The parent bottle identity is exact.",
          identityScope: "product",
          observation: null,
          matchedBottleId: heritageCaskStrengthParentCandidate.bottleId,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [heritageCaskStrengthParentCandidate.bottleId],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            heritageCaskStrengthParentCandidate,
            heritageCaskStrengthBatch1Candidate,
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
        name: "Example Distillery Heritage Cask Strength Batch 2",
      },
      extractedIdentity,
      initialCandidates: [
        heritageCaskStrengthParentCandidate,
        heritageCaskStrengthBatch1Candidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_release",
      parentBottleId: heritageCaskStrengthParentCandidate.bottleId,
      identityScope: "product",
      proposedRelease: {
        edition: "Batch 2",
        statedAge: null,
        abv: 58.2,
        caskStrength: true,
        releaseYear: 2024,
        caskType: "oloroso",
      },
    });
  });

  test("redirects a dirty Macallan age-statement bottle match to the reusable parent bottle", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "The Macallan",
      bottler: null,
      expression: "Sherry Oak",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 30,
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
          confidence: 95,
          rationale: "The title maps to the existing 30-year-old local bottle.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 54083,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [54083, 54082],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            macallanSherryOakLegacy30Candidate,
            macallanSherryOakParentCandidate,
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
        name: "The Macallan Sherry Oak Single Malt Scotch 30-year-old",
      },
      extractedIdentity,
      initialCandidates: [
        macallanSherryOakLegacy30Candidate,
        macallanSherryOakParentCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_release",
      parentBottleId: 54082,
      identityScope: "product",
      proposedRelease: {
        edition: null,
        statedAge: 30,
      },
    });
    expect(result.decision.rationale).toContain(
      "legacy release-like bottle candidate",
    );
  });

  test("keeps a plain age-statement match even when the title abbreviates the age wording", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Tomatin",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Tomatin"],
      category: "single_malt",
      stated_age: 12,
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
          confidence: 95,
          rationale:
            "The generic 12-year-old local bottle is the safest match.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 65001,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [65001, 65002, 65003],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            tomatinLegacy12Candidate,
            tomatinBourbonAndSherryCasksCandidate,
            tomatinCaskStrengthParentCandidate,
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
        name: "Tomatin Single Malt 12 Yr.",
      },
      extractedIdentity,
      initialCandidates: [
        tomatinLegacy12Candidate,
        tomatinBourbonAndSherryCasksCandidate,
        tomatinCaskStrengthParentCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 65001,
      matchedReleaseId: null,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server promoted the bottle match to release creation",
    );
  });

  test("promotes dirty-parent bottle-and-release creation into create_release instead of exact-cask bottle creation", async () => {
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
          action: "create_bottle_and_release",
          confidence: 80,
          rationale:
            "Batch 1 and the differing 35-year age need a child release beneath the Rare Cask Release family.",
          identityScope: "product",
          observation: {
            selector: "shop.example Glenglassaugh Rare Cask Batch 1 listing",
            caskNumber: "casks 1803, 1810 (reported by producer/press)",
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [2457],
          proposedBottle: {
            name: "Rare Cask Release",
            series: {
              id: null,
              name: "Rare Cask Release",
            },
            category: "single_malt",
            edition: "Batch 1",
            statedAge: 35,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: 1978,
            releaseYear: 2014,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "Glenglassaugh",
            },
            distillers: [
              {
                id: null,
                name: "Glenglassaugh",
              },
            ],
            bottler: null,
          },
          proposedRelease: {
            edition: "Batch 1",
            statedAge: 35,
            abv: null,
            caskStrength: null,
            singleCask: true,
            vintageYear: 1978,
            releaseYear: 2014,
            caskType: null,
            caskSize: null,
            caskFill: null,
            description: null,
            tastingNotes: null,
            imageUrl: null,
          },
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

  test("keeps a uniquely supported bottle match when the title adds producer context beyond the canonical bottle name", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Ledaig",
      bottler: null,
      expression: "Stiuireadair",
      series: null,
      distillery: ["Tobermory"],
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
          confidence: 88,
          rationale:
            "The local bottle aligns on brand, distillery, category, and the distinctive expression name.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 41258,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [41258, 41259],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            ledaigStiuireadairCandidate,
            ledaigStiuiredairNearDuplicateCandidate,
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
        name: "Tobermory Ledaig Stiuireadair Single Malt Scotch Whisky",
      },
      extractedIdentity,
      initialCandidates: [
        ledaigStiuireadairCandidate,
        ledaigStiuiredairNearDuplicateCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 41258,
      matchedReleaseId: null,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps a uniquely supported plain age-statement bottle match when the local bottle name is distillery-qualified", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Jura",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Jura"],
      category: "single_malt",
      stated_age: 12,
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
          confidence: 87,
          rationale:
            "The local bottle aligns on the Jura brand family, category, and the 12-year-old age-statement core bottling.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 3233,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [3233, 4306],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [jura12YearOldCandidate, juraElixirCandidate],
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
        name: "Jura 12-year-old Scotch Whisky",
      },
      extractedIdentity,
      initialCandidates: [jura12YearOldCandidate, juraElixirCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 3233,
      matchedReleaseId: null,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps a uniquely supported bottle match when a sibling only omits the decisive marketed age statement", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Canadian Club",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: [],
      category: "blend",
      stated_age: 9,
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
          confidence: 97,
          rationale:
            "The 9-year Reserve bottle is the strongest existing match, and Triple Aged reads as extra label wording rather than a separate product family.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 16913,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [16913, 17346],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            canadianClubReserve9YearOldCandidate,
            canadianClubReserve40Candidate,
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
        name: "Canadian Club 9-year-old Reserve Canadian Whisky",
        url: "https://example.com/products/canadian-club-reserve-9-year-old",
      },
      extractedIdentity,
      initialCandidates: [
        canadianClubReserve9YearOldCandidate,
        canadianClubReserve40Candidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      confidence: 97,
      matchedBottleId: 16913,
      matchedReleaseId: null,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("downgrades a plain age parent when the extracted identity includes extra cask detail", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Jura",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Jura"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: "oloroso",
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
          confidence: 82,
          rationale:
            "The local Jura 12-year-old bottle appears close to the listing.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 3233,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [3233, 3234],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [jura12YearOldCandidate, juraSherryCaskCandidate],
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
        name: "Jura 12-year-old Sherry Cask Scotch Whisky",
      },
      extractedIdentity,
      initialCandidates: [jura12YearOldCandidate, juraSherryCaskCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("still downgrades a more specific batch-A bottle when the listing omits the lettered release suffix", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Redbreast",
      bottler: null,
      expression: "Small Batch Cask Strength",
      series: null,
      distillery: ["Midleton"],
      category: "single_pot_still",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 84,
          rationale: "The local candidate looks close to the listing.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 9101,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [9101],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [redbreastBatchACandidate],
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
        name: "Redbreast Small Batch Cask Strength",
      },
      extractedIdentity,
      initialCandidates: [redbreastBatchACandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps a bottle match when the listing only differs by apostrophe spelling", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Lagavulin",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Lagavulin"],
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
          confidence: 90,
          rationale: "The local bottle identity matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [44006],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [lagavulinDistillersEditionParentCandidate],
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
        name: "Lagavulin Distiller's Edition",
      },
      extractedIdentity,
      initialCandidates: [lagavulinDistillersEditionParentCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
      matchedReleaseId: null,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps a release match when authoritative evidence only mentions the brand in possessive summary text", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Lagavulin",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Lagavulin"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: 2023,
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
          confidence: 91,
          rationale: "The existing 2023 release matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          matchedReleaseId: 78,
          parentBottleId: null,
          candidateBottleIds: [44006],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            {
              provider: "openai",
              query: '"Lagavulin Distillers Edition 2023"',
              summary:
                "Lagavulin's official site lists the Distillers Edition 2023 release.",
              results: [
                {
                  title:
                    "Distillers Edition 2023 Release | Official Product Page",
                  url: "https://www.lagavulin.com/en-us/whiskies/distillers-edition-2023",
                  domain: "lagavulin.com",
                  description:
                    "Official product page for the Distillers Edition 2023 release.",
                  extraSnippets: [],
                },
              ],
            },
          ],
          candidates: [
            lagavulinDistillersEditionParentCandidate,
            lagavulinDistillersEdition2023ReleaseCandidate,
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
        name: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
        url: "https://shop.example/products/lagavulin-distillers-edition-2023",
      },
      extractedIdentity,
      initialCandidates: [
        lagavulinDistillersEditionParentCandidate,
        lagavulinDistillersEdition2023ReleaseCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
      matchedReleaseId: 78,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("does not treat retailer-only off-origin web results as supportive evidence for a parent bottle match", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Lagavulin",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Lagavulin"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: 2023,
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
          rationale: "The parent bottle is the closest local candidate.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [44006],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            {
              provider: "openai",
              query: '"Lagavulin Distillers Edition 2023"',
              summary:
                "Retailer results list Lagavulin Distillers Edition 2023 for sale.",
              results: [
                {
                  title: "Lagavulin Distillers Edition 2023 | Buy Online",
                  url: "https://www.totalwine.com/spirits/scotch/lagavulin-distillers-edition-2023/p/12345",
                  domain: "totalwine.com",
                  description:
                    "Shop Lagavulin Distillers Edition 2023 online at Total Wine.",
                  extraSnippets: [],
                },
              ],
            },
          ],
          candidates: [lagavulinDistillersEditionParentCandidate],
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
        name: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
        url: "https://shop.example/products/lagavulin-distillers-edition-2023",
      },
      extractedIdentity,
      initialCandidates: [lagavulinDistillersEditionParentCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps a uniquely supported annual release match without web evidence", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Lagavulin",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Lagavulin"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: 2023,
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
          confidence: 91,
          rationale: "The existing 2023 release matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          matchedReleaseId: 78,
          parentBottleId: null,
          candidateBottleIds: [44006],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            lagavulinDistillersEditionParentCandidate,
            lagavulinDistillersEdition2023ReleaseCandidate,
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
        name: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
      },
      extractedIdentity,
      initialCandidates: [
        lagavulinDistillersEditionParentCandidate,
        lagavulinDistillersEdition2023ReleaseCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
      matchedReleaseId: 78,
      parentBottleId: null,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("downgrades an annual release match when the surfaced sibling releases still tie on the same bare year", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Lagavulin",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Lagavulin"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: 2023,
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
          rationale: "One of the 2023 releases appears to match the listing.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          matchedReleaseId: 79,
          parentBottleId: null,
          candidateBottleIds: [44006],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            lagavulinDistillersEditionParentCandidate,
            lagavulinDistillersEdition2023SpringReleaseCandidate,
            lagavulinDistillersEdition2023AutumnReleaseCandidate,
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
        name: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
      },
      extractedIdentity,
      initialCandidates: [
        lagavulinDistillersEditionParentCandidate,
        lagavulinDistillersEdition2023SpringReleaseCandidate,
        lagavulinDistillersEdition2023AutumnReleaseCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("downgrades a plain parent-bottle match when the listing still carries release identity and an existing release candidate blocks promotion", async () => {
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
          confidence: 88,
          rationale: "The parent bottle is the closest local match.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 13442,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [13442],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            cadbollEstateParentCandidate,
            cadbollEstateBatch4ReleaseCandidate,
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
        cadbollEstateParentCandidate,
        cadbollEstateBatch4ReleaseCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
    });
    expect(result.decision.rationale).toContain(
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

  test("creates a reusable parent when exact dirty siblings prove a shared family", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Glengoyne",
      bottler: null,
      expression: "The Legacy Series",
      series: null,
      distillery: ["Glengoyne"],
      category: "single_malt",
      stated_age: null,
      abv: 48,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Chapter Two",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 95,
          rationale:
            "The title exactly matches the existing local Chapter Two bottle.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 2083,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [2083, 2460],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            glengoyneLegacySeriesChapterTwoCandidate,
            glengoyneLegacySeriesChapterOneCandidate,
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
        name: "Glengoyne The Legacy Series Chapter Two",
      },
      extractedIdentity,
      initialCandidates: [
        glengoyneLegacySeriesChapterTwoCandidate,
        glengoyneLegacySeriesChapterOneCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_bottle_and_release",
      identityScope: "product",
      proposedBottle: {
        brand: {
          name: "Glengoyne",
        },
        name: "The Legacy Series",
      },
      proposedRelease: {
        edition: "Chapter Two",
      },
    });
    expect(result.decision.rationale).toContain(
      "sibling-specific legacy bottle row",
    );
  });

  test("redirects a Penelope batch bottle match to the reusable parent bottle", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Penelope",
      bottler: null,
      expression: "Bourbon Barrel Strength Straight Bourbon Whiskey",
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
      edition: "Batch 11",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          confidence: 96,
          rationale:
            "The title matches the existing local Batch 11 bottle candidate.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 54069,
          matchedReleaseId: null,
          parentBottleId: null,
          candidateBottleIds: [54069, 54068],
          proposedBottle: null,
          proposedRelease: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            penelopeLegacyBatch11Candidate,
            penelopeBarrelStrengthParentCandidate,
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
        name: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey (Batch 11)",
      },
      extractedIdentity,
      initialCandidates: [
        penelopeLegacyBatch11Candidate,
        penelopeBarrelStrengthParentCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_release",
      parentBottleId: 54068,
      identityScope: "product",
      proposedRelease: {
        edition: "Batch 11",
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

  test("keeps bare SMWS code references anchored to the code when creating an exact-cask bottle", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "SMWS",
      bottler: "Scotch Malt Whisky Society",
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: true,
      edition: "6.53",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          confidence: 94,
          rationale:
            "SMWS 6.53 is a distinct exact-cask bottle and web evidence also reveals the official subtitle.",
          candidateBottleIds: [],
          identityScope: "exact_cask",
          observation: {
            selector: "Fresh from the replicator",
            caskNumber: "6.53",
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          matchedBottleId: null,
          matchedReleaseId: null,
          parentBottleId: null,
          proposedBottle: {
            name: "Fresh from the replicator",
            series: null,
            category: "single_malt",
            edition: "6.53",
            statedAge: 13,
            caskStrength: null,
            singleCask: true,
            abv: 57.9,
            vintageYear: 2008,
            releaseYear: 2021,
            caskType: "other",
            caskSize: "barrel",
            caskFill: "2nd_fill",
            brand: {
              id: null,
              name: "SMWS",
            },
            distillers: [
              {
                id: null,
                name: "Macduff",
              },
            ],
            bottler: {
              id: null,
              name: "Scotch Malt Whisky Society",
            },
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
        name: "SMWS 6.53",
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
      proposedBottle: {
        name: "6.53",
        edition: null,
        statedAge: 13,
        singleCask: true,
        abv: 57.9,
      },
      observation: {
        selector: "Fresh from the replicator",
        caskNumber: "6.53",
      },
    });
  });
});
