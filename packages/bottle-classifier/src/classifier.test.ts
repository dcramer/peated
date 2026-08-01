import { Runner } from "@openai/agents";
import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";
import {
  createBottleClassifier,
  prepareBottleClassifierAgentRun,
  type BottleClassifierDataSource,
  type BottleClassifierToolEvent,
  type CreateBottleClassifierOptions,
  type RunBottleClassifierAgentInput,
} from "./classifierRuntime";
import type {
  BottleCandidate,
  BottleClassifierAgentDecisionInput,
  BottleExtractedDetails,
  EntityResolution,
  SearchEntitiesArgs,
} from "./classifierTypes";
import {
  buildBottleClassificationArtifacts,
  type BottleClassificationArtifacts,
  type Finding,
  type ProposedOperation,
} from "./contract";
import { buildBottleCandidate } from "./evalFixtureBuilders";

type ReasoningResult = {
  decision: BottleClassifierAgentDecisionInput;
  proposedOperations?: ProposedOperation[];
  findings?: Finding[];
  artifacts: Parameters<typeof buildBottleClassificationArtifacts>[0];
};

function nativeAgentResult({
  finalOutput,
  inputTokens,
  outputTokens,
  toolNames = [],
}: {
  finalOutput: unknown;
  inputTokens: number;
  outputTokens: number;
  toolNames?: string[];
}) {
  return {
    finalOutput,
    state: {
      usage: {
        requests: 1,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    },
    newItems: toolNames.map((name) => ({
      type: "tool_call_output_item",
      rawItem: { name },
    })),
  };
}

function noMatchAgentDecision() {
  return {
    action: "no_match" as const,
    rationale: "No safe Bottle resolution.",
    candidateBottleIds: [],
    identityScope: "product" as const,
    observation: null,
    matchedBottleId: null,
    proposedBottle: null,
  };
}

function createReliableSearchEvidence({
  query,
  summary,
}: {
  query: string;
  summary: string;
}): BottleClassificationArtifacts["searchEvidence"][number] {
  return {
    provider: "openai",
    query,
    summary,
    results: [
      {
        title: summary,
        url: "https://www.whiskyadvocate.com/reviews/classifier-evidence",
        domain: "whiskyadvocate.com",
        description: summary,
        extraSnippets: [],
      },
    ],
  };
}

const supportiveWebEvidenceConfidenceBasis = {
  positiveEvidence: [
    "Reliable non-origin web evidence supports the proposed bottle identity.",
  ],
  unresolvedRisks: [],
  toolsUsed: ["openai_web_search"],
  webEvidence: "supportive",
} as const satisfies NonNullable<
  BottleClassifierAgentDecisionInput["confidenceBasis"]
>;

// Keep this file focused on deterministic classifier boundary behavior.
// Real-bottle workflow regressions belong in the fixture-driven eval corpus,
// not in additional mocked classifier behavior tests here.
function createTestClassifier({
  client = {} as OpenAI,
  extractedIdentity = null,
  extractedIdentityFromImage,
  extractedIdentityFromText,
  extractFromText,
  extractFromImageError,
  maxSearchQueries = 2,
  firecrawlApiKey,
  searchBottles = vi.fn(async () => [] as BottleCandidate[]),
  searchEntities,
  getBottleCandidateById,
  getBottleContext,
  runBottleClassifierAgent,
  executeWebSearch,
  observeToolEvent,
}: {
  client?: OpenAI;
  extractedIdentity?: BottleExtractedDetails | null;
  extractedIdentityFromImage?: BottleExtractedDetails | null;
  extractedIdentityFromText?: BottleExtractedDetails | null;
  extractFromText?: (label: string) => Promise<BottleExtractedDetails | null>;
  extractFromImageError?: Error | null;
  maxSearchQueries?: number;
  firecrawlApiKey?: string;
  searchBottles?: ReturnType<
    typeof vi.fn<(args: unknown) => Promise<BottleCandidate[]>>
  >;
  searchEntities?: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
  getBottleCandidateById?: (
    bottleId: number,
  ) => Promise<BottleCandidate | null>;
  getBottleContext?: BottleClassifierDataSource["getBottleContext"];
  runBottleClassifierAgent?: (
    args: RunBottleClassifierAgentInput,
  ) => Promise<ReasoningResult>;
  executeWebSearch?: CreateBottleClassifierOptions["executeWebSearch"];
  observeToolEvent?: CreateBottleClassifierOptions["observeToolEvent"];
}) {
  return {
    classifier: createBottleClassifier({
      client,
      model: "test-model",
      maxSearchQueries,
      firecrawlApiKey,
      executeWebSearch,
      observeToolEvent,
      adapters: {
        searchBottles,
        searchEntities,
        getBottleCandidateById,
        getBottleContext,
      },
      overrides: {
        extractFromImage: async () => {
          if (extractFromImageError) {
            throw extractFromImageError;
          }
          return extractedIdentityFromImage ?? extractedIdentity;
        },
        extractFromText:
          extractFromText ??
          (async () => extractedIdentityFromText ?? extractedIdentity),
        runBottleClassifierAgent: runBottleClassifierAgent
          ? async (input) => {
              const result = await runBottleClassifierAgent(input);
              return {
                ...result,
                artifacts: buildBottleClassificationArtifacts(result.artifacts),
              };
            }
          : undefined,
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
  cask_strength: null,
  single_cask: null,
  cask_type: null,
  cask_size: null,
  cask_fill: null,
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
  cask_strength: null,
  single_cask: null,
  cask_type: null,
  cask_size: null,
  cask_fill: null,
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
  cask_strength: null,
  single_cask: true,
  cask_type: null,
  cask_size: null,
  cask_fill: null,
  edition: null,
};

const rareBreedNearMatch: BottleCandidate = {
  bottleId: 7,
  alias: null,
  fullName: "Wild Turkey Rare Breed Barrel Proof",
  brand: "Wild Turkey",
  bottler: null,
  series: null,
  distillery: [],
  category: "rye",
  statedAge: null,
  edition: null,
  caskStrength: true,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.6,
  source: ["vector"],
};

const elijahCraigBarrelProofCandidate: BottleCandidate = {
  bottleId: 620,
  alias: null,
  fullName: "Elijah Craig Barrel Proof",
  brand: "Elijah Craig",
  bottler: null,
  series: null,
  distillery: ["Heaven Hill"],
  category: "bourbon",
  statedAge: 12,
  edition: null,
  caskStrength: true,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.94,
  source: ["exact"],
};

const glenglassaughRareCaskCandidate: BottleCandidate = {
  bottleId: 2457,
  alias: null,
  fullName: "Glenglassaugh 1978 Rare Cask Release",
  brand: "Glenglassaugh",
  bottler: null,
  series: null,
  distillery: ["Glenglassaugh"],
  category: "single_malt",
  statedAge: 40,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.95,
  source: ["exact"],
};

const macallanSherryOakCandidate: BottleCandidate = {
  bottleId: 54082,
  alias: null,
  fullName: "The Macallan Sherry Oak",
  brand: "The Macallan",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.9,
  source: ["text"],
};

const macallanSherryOakLegacy30Candidate: BottleCandidate = {
  bottleId: 54083,
  alias: "The Macallan Sherry Oak Single Malt Scotch 30-year-old",
  fullName: "The Macallan Sherry Oak 30-year-old",
  brand: "The Macallan",
  bottler: null,
  series: null,
  distillery: [],
  category: "single_malt",
  statedAge: 30,
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

const tomatinLegacy12Candidate: BottleCandidate = {
  bottleId: 65001,
  alias: "Tomatin Single Malt 12-year-old",
  fullName: "Tomatin 12-year-old",
  brand: "Tomatin",
  bottler: null,
  series: null,
  distillery: ["Tomatin"],
  category: "single_malt",
  statedAge: 12,
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

const tomatinCaskStrengthCandidate: BottleCandidate = {
  bottleId: 65002,
  alias: null,
  fullName: "Tomatin Cask Strength",
  brand: "Tomatin",
  bottler: null,
  series: null,
  distillery: ["Tomatin"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: true,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.82,
  source: ["text"],
};

const tomatinBourbonAndSherryCasksCandidate: BottleCandidate = {
  bottleId: 65003,
  alias: null,
  fullName: "Tomatin 12-year-old Bourbon & Sherry Casks",
  brand: "Tomatin",
  bottler: null,
  series: null,
  distillery: ["Tomatin"],
  category: "single_malt",
  statedAge: 12,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: 43,
  vintageYear: null,
  releaseYear: null,
  score: 0.81,
  source: ["text"],
};

const penelopeBarrelStrengthCandidate: BottleCandidate = {
  bottleId: 54068,
  alias: null,
  fullName: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey",
  brand: "Penelope",
  bottler: null,
  series: null,
  distillery: [],
  category: "bourbon",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.89,
  source: ["text"],
};

const penelopeLegacyBatch11Candidate: BottleCandidate = {
  bottleId: 54069,
  alias: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey Batch 11",
  fullName:
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
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 1,
  source: ["exact"],
};

const taleOfIceCreamCandidate: BottleCandidate = {
  bottleId: 43236,
  alias: null,
  fullName: "Glenmorangie A Tale of Ice Cream",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.9,
  source: ["text"],
};

const ledaigStiuireadairCandidate: BottleCandidate = {
  bottleId: 41258,
  alias: "Ledaig Stiuireadair",
  fullName: "Ledaig Stiuireadair",
  brand: "Ledaig",
  bottler: null,
  series: null,
  distillery: ["Tobermory"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.88,
  source: ["text"],
};

const ledaigStiuiredairNearDuplicateCandidate: BottleCandidate = {
  bottleId: 41259,
  alias: "Ledaig Stiuiredair",
  fullName: "Ledaig Stiuiredair",
  brand: "Ledaig",
  bottler: null,
  series: null,
  distillery: ["Tobermory"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.84,
  source: ["vector"],
};

const jura12YearOldCandidate: BottleCandidate = {
  bottleId: 3233,
  alias: null,
  fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
  brand: "Jura",
  bottler: null,
  series: null,
  distillery: ["Isle of Jura"],
  category: "single_malt",
  statedAge: 12,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.91,
  source: ["text"],
};

const juraElixirCandidate: BottleCandidate = {
  bottleId: 4306,
  alias: null,
  fullName: "Jura Elixir",
  brand: "Jura",
  bottler: null,
  series: null,
  distillery: ["Isle of Jura"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.72,
  source: ["text"],
};

const juraSherryCaskCandidate: BottleCandidate = {
  bottleId: 3234,
  alias: null,
  fullName: "Jura 12-year-old Sherry Cask Single Malt Scotch Whisky",
  brand: "Jura",
  bottler: null,
  series: null,
  distillery: ["Isle of Jura"],
  category: "single_malt",
  statedAge: 12,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.88,
  source: ["text"],
};

const canadianClubReserve9YearOldCandidate: BottleCandidate = {
  bottleId: 16913,
  alias: null,
  fullName: "Canadian Club Reserve 9-year-old Triple Aged",
  brand: "Canadian",
  bottler: null,
  series: null,
  distillery: [],
  category: "blend",
  statedAge: 9,
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
  source: ["text"],
};

const canadianClubReserve40Candidate: BottleCandidate = {
  bottleId: 17346,
  alias: null,
  fullName: "Canadian Club Reserve, 40% ABV",
  brand: "Canadian",
  bottler: null,
  series: null,
  distillery: [],
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
  releaseYear: null,
  score: 1,
  source: ["text"],
};

const redbreastBatchACandidate: BottleCandidate = {
  bottleId: 9101,
  alias: null,
  fullName: "Redbreast Small Batch Cask Strength Batch A",
  brand: "Redbreast",
  bottler: null,
  series: null,
  distillery: ["Midleton"],
  category: "single_pot_still",
  statedAge: null,
  edition: null,
  caskStrength: true,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.83,
  source: ["text"],
};

const springbank10YearOldCandidate: BottleCandidate = {
  bottleId: 11,
  alias: "Springbank 10-year-old",
  fullName: "Springbank 10-year-old",
  brand: "Springbank",
  bottler: null,
  series: null,
  distillery: ["Springbank"],
  category: "single_malt",
  statedAge: 10,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: 46,
  vintageYear: null,
  releaseYear: null,
  score: 0.99,
  source: ["exact"],
};

const springbank10YearOldIdentity: BottleExtractedDetails = {
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
  cask_strength: null,
  single_cask: null,
  cask_type: null,
  cask_size: null,
  cask_fill: null,
  edition: null,
};

const cadbollEstateBaseCandidate: BottleCandidate = {
  bottleId: 13442,
  alias: null,
  fullName: "Glenmorangie 15-year-old The Cadboll Estate",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.92,
  source: ["text"],
};

const cadbollEstateLegacyBatch4Candidate: BottleCandidate = {
  bottleId: 43034,
  alias: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
  fullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
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

const cadbollEstateLegacyBatch2Candidate: BottleCandidate = {
  bottleId: 12900,
  alias: null,
  fullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 2)",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.87,
  source: ["text"],
};

const glengoyneLegacySeriesChapterTwoCandidate: BottleCandidate = {
  bottleId: 2083,
  alias: null,
  fullName: "Glengoyne The Legacy Series Chapter Two",
  brand: "Glengoyne",
  bottler: null,
  series: null,
  distillery: ["Glengoyne"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: 48,
  vintageYear: null,
  releaseYear: null,
  score: 0.96,
  source: ["exact"],
};

const glengoyneLegacySeriesChapterOneCandidate: BottleCandidate = {
  bottleId: 2460,
  alias: null,
  fullName: "Glengoyne The Legacy Series Chapter One",
  brand: "Glengoyne",
  bottler: null,
  series: null,
  distillery: ["Glengoyne"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: 48,
  vintageYear: null,
  releaseYear: null,
  score: 0.91,
  source: ["text"],
};

const cadbollEstateBatch4Candidate: BottleCandidate = {
  bottleId: 13442,
  alias: null,
  fullName: "Glenmorangie 15-year-old The Cadboll Estate - Batch 4",
  brand: "Glenmorangie",
  bottler: null,
  series: null,
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 15,
  edition: "Batch 4",
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.9,
  source: ["text"],
};

const lagavulinDistillersEditionBaseCandidate: BottleCandidate = {
  bottleId: 44006,
  alias: null,
  fullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  score: 0.91,
  source: ["text"],
};

const lagavulinDistillersEdition2023Candidate: BottleCandidate = {
  bottleId: 44006,
  alias: null,
  fullName: "Lagavulin Distillers Edition 2023 Release",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: null,
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: 2023,
  score: 0.95,
  source: ["text", "release"],
};

const lagavulinDistillersEdition2023SpringCandidate: BottleCandidate = {
  bottleId: 44006,
  alias: null,
  fullName: "Lagavulin Distillers Edition 2023 Spring Release",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: "Spring Release",
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: 2023,
  score: 0.94,
  source: ["text", "release"],
};

const lagavulinDistillersEdition2023AutumnCandidate: BottleCandidate = {
  bottleId: 44006,
  alias: null,
  fullName: "Lagavulin Distillers Edition 2023 Autumn Release",
  brand: "Lagavulin",
  bottler: null,
  series: null,
  distillery: ["Lagavulin"],
  category: "single_malt",
  statedAge: null,
  edition: "Autumn Release",
  caskStrength: null,
  singleCask: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: null,
  vintageYear: null,
  releaseYear: 2023,
  score: 0.93,
  source: ["text", "release"],
};

describe("createBottleClassifier", () => {
  test("uses Firecrawl web search instead of OpenAI web search when configured", async () => {
    const preparedRun = await prepareBottleClassifierAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 2,
        firecrawlApiKey: "firecrawl-test-key",
        adapters: {
          searchBottles: vi.fn(async () => []),
        },
      },
      {
        reference: {
          name: "Ardbeg Uigeadail",
        },
        extractedIdentity: null,
        initialCandidates: [],
      },
    );

    const toolNames = preparedRun.agent.tools.map((tool) => tool.name);

    expect(toolNames).toContain("firecrawl_web_search");
    expect(toolNames).not.toContain("openai_web_search");
  });

  test("uses OpenAI web search as the no-Firecrawl fallback", async () => {
    const preparedRun = await prepareBottleClassifierAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 2,
        adapters: {
          searchBottles: vi.fn(async () => []),
        },
      },
      {
        reference: {
          name: "Ardbeg Uigeadail",
        },
        extractedIdentity: null,
        initialCandidates: [],
      },
    );

    const toolNames = preparedRun.agent.tools.map((tool) => tool.name);

    expect(toolNames).toContain("openai_web_search");
    expect(toolNames).not.toContain("firecrawl_web_search");
  });

  test("rebuilds search artifacts from OpenAI Agents tool output", async () => {
    const preparedRun = await prepareBottleClassifierAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 2,
        adapters: {
          searchBottles: vi.fn(async () => []),
        },
      },
      {
        reference: {
          name: "Ardbeg Uigeadail",
        },
        extractedIdentity: null,
        initialCandidates: [],
      },
    );
    const webSearchEvidence = {
      provider: "openai",
      query: "Ardbeg Uigeadail official",
      summary: "Official producer evidence for Ardbeg Uigeadail.",
      results: [
        {
          title: "Ardbeg Uigeadail",
          url: "https://www.ardbeg.com/en-us/whisky/uigeadail",
          domain: "ardbeg.com",
          description: null,
          extraSnippets: [],
        },
      ],
    };

    const reasoning = preparedRun.getAgentResult({
      finalOutput: {
        action: "no_match",
        rationale: "No local candidate was provided.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
      newItems: [
        {
          type: "tool_call_output_item",
          rawItem: {
            type: "function_call_result",
            name: "openai_web_search",
            output: JSON.stringify(webSearchEvidence),
          },
        },
      ],
    });

    expect(reasoning.artifacts.searchEvidence).toEqual([webSearchEvidence]);
    expect(reasoning.decision).toMatchObject({});
  });

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
          rationale: "Closed-set review could not reuse a broader Bottle.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Festival Distillery",
            },
            distillers: [],
            bottler: null,
          },
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

  test("identifies existing bottles with the local-only classifier pass", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The local candidate safely covers the label.",
          candidateBottleIds: [11],
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: ["The local candidate matches."],
            unresolvedRisks: [],
            toolsUsed: ["initial_local_candidates", "openai_web_search"],
            webEvidence: "supportive",
          },
          matchedBottleId: 11,
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity: springbank10YearOldIdentity,
          imageEvidence: null,
          searchEvidence: [],
          candidates: [springbank10YearOldCandidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: springbank10YearOldIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.identifyExistingBottleReference({
      reference: {
        name: "Springbank 10-year-old",
      },
      extractedIdentity: springbank10YearOldIdentity,
      initialCandidates: [springbank10YearOldCandidate],
    });

    expect(result).toMatchObject({
      status: "classified",
      decision: {
        action: "match",
        matchedBottleId: 11,
        confidenceBasis: {
          toolsUsed: ["initial_local_candidates"],
          webEvidence: "not_used",
        },
      },
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledOnce();
    const [[agentInput]] = runBottleClassifierAgent.mock.calls as unknown as [
      [RunBottleClassifierAgentInput],
    ];
    expect(agentInput).toMatchObject({
      candidateExpansion: "initial_only",
      searchEvidence: [],
      resolvedEntities: [],
      investigationHint: null,
      instructionMode: "local_identification",
    });
    expect(agentInput?.webSearchBudget?.tryConsume()).toBe(false);
  });

  test("converts non-match local identification decisions to no_match", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "The label appears to be a new local product.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: {
            name: "Local Only",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Example",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity: null,
          imageEvidence: null,
          searchEvidence: [],
          candidates: [springbank10YearOldCandidate],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      runBottleClassifierAgent,
    });

    const result = await classifier.identifyExistingBottleReference({
      reference: {
        name: "Example Local Only",
      },
      extractedIdentity: null,
      initialCandidates: [springbank10YearOldCandidate],
    });

    expect(result).toMatchObject({
      status: "classified",
      decision: {
        action: "no_match",
        matchedBottleId: null,
        proposedBottle: null,
      },
    });
  });

  test("short-circuits deterministic local create decisions to no_match", async () => {
    const extractFromText = vi.fn(async (): Promise<BottleExtractedDetails> => {
      throw new Error(
        "SMWS deterministic references should not need extraction",
      );
    });
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => {
        throw new Error(
          "Deterministic local create decisions should not need the agent",
        );
      },
    );
    const { classifier } = createTestClassifier({
      extractFromText,
      runBottleClassifierAgent,
    });

    const result = await classifier.identifyExistingBottleReference({
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
      },
      initialCandidates: [springbank10YearOldCandidate],
    });

    expect(result).toMatchObject({
      status: "classified",
      decision: {
        action: "no_match",
        matchedBottleId: null,
        proposedBottle: null,
        confidenceBasis: {
          toolsUsed: ["initial_local_candidates"],
          webEvidence: "not_used",
        },
      },
    });
    expect(extractFromText).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("seeds local entity results for the reasoning pass", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Bothan",
      bottler: "Alexander Murray & Co",
      expression: "Bourbon Cask",
      series: null,
      distillery: ["Unknown Lowland Distillery"],
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
    };
    const searchEntities = vi.fn(
      async (args: SearchEntitiesArgs): Promise<EntityResolution[]> => [
        {
          entityId: args.query.length,
          name: args.query,
          shortName: null,
          type: args.type ? [args.type] : [],
          alias: null,
          score: 0.98,
          source: ["entity_text"],
        },
      ],
    );
    const runBottleClassifierAgent = vi.fn(
      async ({ resolvedEntities }): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          rationale: "Entity context was available but no bottle matched.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          candidates: [],
          searchEvidence: [],
          resolvedEntities: resolvedEntities ?? [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      searchEntities,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Bothan Lowland Single Malt Scotch Bourbon Cask Scotch Whisky",
      },
    });

    expect(searchEntities).toHaveBeenCalledWith({
      query: "Bothan",
      type: "brand",
      limit: 5,
    });
    expect(searchEntities).toHaveBeenCalledWith({
      query: "Alexander Murray & Co",
      type: "bottler",
      limit: 5,
    });
    expect(searchEntities).toHaveBeenCalledWith({
      query: "Unknown Lowland Distillery",
      type: "distiller",
      limit: 5,
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        resolvedEntities: expect.arrayContaining([
          expect.objectContaining({
            name: "Bothan",
            type: ["brand"],
            retrievedFor: [
              {
                query: "Bothan",
                requestedType: "brand",
              },
            ],
          }),
          expect.objectContaining({
            name: "Alexander Murray & Co",
            type: ["bottler"],
            retrievedFor: [
              {
                query: "Alexander Murray & Co",
                requestedType: "bottler",
              },
            ],
          }),
        ]),
      }),
    );
    expect(result.status).toBe("classified");
  });

  test("bounds candidate-derived entity searches after source fields", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Source Brand",
      bottler: null,
      expression: "Expression",
      series: null,
      distillery: [],
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
    };
    const candidates = Array.from({ length: 20 }, (_, index) =>
      buildBottleCandidate({
        bottleId: 5000 + index,
        brand: `Candidate Brand ${index}`,
        fullName: `Candidate Brand ${index} Expression`,
      }),
    );
    const searchEntities = vi.fn(async () => [] as EntityResolution[]);
    const runBottleClassifierAgent = vi.fn(
      async ({ resolvedEntities }): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          rationale: "No candidate matched.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          candidates,
          searchEvidence: [],
          resolvedEntities: resolvedEntities ?? [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity,
      searchBottles: vi.fn(async () => candidates),
      searchEntities,
      runBottleClassifierAgent,
    });

    await classifier.classifyBottleReference({
      reference: { name: "Source Brand Expression Single Malt Whisky" },
    });

    expect(searchEntities).toHaveBeenCalledTimes(13);
    expect(searchEntities).toHaveBeenCalledWith({
      query: "Source Brand",
      type: "brand",
      limit: 5,
    });
  });

  test("does not post-backfill web evidence for create decisions when the agent skipped search", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text:
        "Festival Distillery confirms Warehouse Session is a single malt whisky.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            sources: [
              {
                type: "url",
                url: "https://www.festivaldistillery.com/warehouse-session",
              },
              {
                type: "url",
                url: "https://www.whiskyadvocate.com/ratings-reviews/festival-distillery-warehouse-session/",
              },
            ],
          },
        },
      ],
    });
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "No local bottle matched the reference.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: ["The label supports the proposed bottle."],
            unresolvedRisks: [],
            toolsUsed: ["none"],
            webEvidence: "not_needed",
          },
          matchedBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Festival Distillery",
            },
            distillers: [
              {
                id: null,
                name: "Festival Distillery",
              },
            ],
            bottler: null,
          },
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
      client: {
        responses: {
          create,
        },
      } as unknown as OpenAI,
      extractedIdentity: null,
      maxSearchQueries: 1,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Festival Distillery Warehouse Session Single Malt",
        url: "https://origin-retailer.example/products/warehouse-session",
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.status).toBe("classified");
    if (result.status !== "classified") return;
    expect(result.artifacts.searchEvidence).toHaveLength(0);
    expect(result.decision).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Warehouse Session",
      },
    });
  });

  test("preserves create decisions when external web evidence does not support the proposed bottle", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "No local bottle matched the reference.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Festival Distillery",
            },
            distillers: [
              {
                id: null,
                name: "Festival Distillery",
              },
            ],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity: null,
          candidates: [],
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Festival Distillery Warehouse Session",
              summary:
                "Other Distillery Rainwater Batch is a single malt whisky.",
            }),
          ],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      maxSearchQueries: 0,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Festival Distillery Warehouse Session Single Malt",
        url: "https://origin-retailer.example/products/warehouse-session",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") return;
    expect(result.decision).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Warehouse Session",
      },
    });
  });

  test("accepts reviewed create decisions with matching non-origin web evidence without a domain allowlist", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "A non-origin source corroborates the proposed bottle identity.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: [
              "A non-origin source corroborates the exact bottle name.",
            ],
            unresolvedRisks: [],
            toolsUsed: ["openai_web_search"],
            webEvidence: "supportive",
          },
          matchedBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Festival Distillery",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity: null,
          candidates: [],
          searchEvidence: [
            {
              provider: "openai",
              query: "Festival Distillery Warehouse Session",
              summary:
                "Festival Distillery Warehouse Session is a single malt whisky.",
              results: [
                {
                  title: "Festival Distillery Warehouse Session",
                  url: "https://community-notes.example/festival-warehouse-session",
                  domain: "community-notes.example",
                  description:
                    "Festival Distillery Warehouse Session single malt whisky.",
                  extraSnippets: [],
                },
              ],
            },
          ],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      maxSearchQueries: 0,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Festival Distillery Warehouse Session Single Malt",
        url: "https://origin-retailer.example/products/warehouse-session",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") return;
    expect(result.decision).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        brand: {
          name: "Festival Distillery",
        },
        name: "Warehouse Session",
      },
    });
  });

  test("preserves create decisions when the agent marks matching web evidence weak", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "The source text matches the proposed bottle but the web result is weak.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          identityBasis: null,
          confidenceBasis: {
            positiveEvidence: [
              "A non-origin page mentions the same bottle name.",
            ],
            unresolvedRisks: [
              {
                category: "web_evidence_conflict",
                note: "The corroborating result may be copied retailer text.",
              },
            ],
            toolsUsed: ["openai_web_search"],
            webEvidence: "weak",
          },
          matchedBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Festival Distillery",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity: null,
          candidates: [],
          searchEvidence: [
            {
              provider: "openai",
              query: "Festival Distillery Warehouse Session",
              summary:
                "Festival Distillery Warehouse Session is a single malt whisky.",
              results: [
                {
                  title: "Festival Distillery Warehouse Session",
                  url: "https://community-notes.example/festival-warehouse-session",
                  domain: "community-notes.example",
                  description:
                    "Festival Distillery Warehouse Session single malt whisky.",
                  extraSnippets: [],
                },
              ],
            },
          ],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      maxSearchQueries: 0,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Festival Distillery Warehouse Session Single Malt",
        url: "https://origin-retailer.example/products/warehouse-session",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") return;
    expect(result.decision).toMatchObject({
      action: "create_bottle",
      confidenceBasis: {
        webEvidence: "weak",
      },
    });
  });

  test("preserves create decisions when external web evidence has not been judged supportive", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "A non-origin source text matches the proposed bottle identity.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: {
            name: "Warehouse Session",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Festival Distillery",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity: null,
          candidates: [],
          searchEvidence: [
            {
              provider: "openai",
              query: "Festival Distillery Warehouse Session",
              summary:
                "Festival Distillery Warehouse Session is a single malt whisky.",
              results: [
                {
                  title: "Festival Distillery Warehouse Session",
                  url: "https://community-notes.example/festival-warehouse-session",
                  domain: "community-notes.example",
                  description:
                    "Festival Distillery Warehouse Session single malt whisky.",
                  extraSnippets: [],
                },
              ],
            },
          ],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: null,
      maxSearchQueries: 0,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Festival Distillery Warehouse Session Single Malt",
        url: "https://origin-retailer.example/products/warehouse-session",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") return;
    expect(result.decision).toMatchObject({
      action: "create_bottle",
      proposedBottle: {
        name: "Warehouse Session",
      },
    });
  });

  test.each([
    {
      provider: "OpenAI",
      toolName: "openai_web_search" as const,
      firecrawlApiKey: undefined,
    },
    {
      provider: "Firecrawl",
      toolName: "firecrawl_web_search" as const,
      firecrawlApiKey: "firecrawl-test-key",
    },
  ])(
    "replays and observes $provider preloaded web evidence within the shared budget",
    async ({ toolName, firecrawlApiKey }) => {
      const extractedIdentity: BottleExtractedDetails = {
        brand: "Creag Isle",
        bottler: null,
        expression: null,
        series: null,
        distillery: [],
        category: "single_malt",
        stated_age: 12,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: null,
      };
      const create = vi.fn().mockResolvedValue({
        output_text:
          "Distiller lists Creag Isle 12-year-old Island Single Malt Scotch Whisky as a real 12 year single malt.",
        output: [
          {
            type: "web_search_call",
            action: {
              type: "search",
              sources: [
                {
                  type: "url",
                  url: "https://distiller.com/spirits/creag-isle-12-year-island-single-malt",
                },
              ],
            },
          },
        ],
      });
      const replayedEvidence = {
        ...createReliableSearchEvidence({
          query: "Creag Isle 12 year old single malt",
          summary:
            "Distiller lists Creag Isle 12-year-old Island Single Malt Scotch Whisky as a real 12 year single malt.",
        }),
        provider: firecrawlApiKey
          ? ("firecrawl" as const)
          : ("openai" as const),
      };
      const executeWebSearch: NonNullable<
        CreateBottleClassifierOptions["executeWebSearch"]
      > = vi.fn(async ({ args }) => ({
        ...replayedEvidence,
        query: args.query,
      }));
      const toolEvents: BottleClassifierToolEvent[] = [];
      const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
      const runBottleClassifierAgent = vi.fn(
        async ({
          searchEvidence,
          webSearchBudget,
        }): Promise<ReasoningResult> => {
          expect(webSearchBudget?.tryConsume()).toBe(false);
          if (searchEvidence?.length) {
            return {
              decision: {
                action: "create_bottle",
                rationale:
                  "Web evidence confirms Creag Isle 12-year-old Island Single Malt as a standalone bottle.",
                candidateBottleIds: [],
                identityScope: "product",
                observation: null,
                confidenceBasis: {
                  ...supportiveWebEvidenceConfidenceBasis,
                  toolsUsed: [toolName],
                },
                matchedBottleId: null,
                proposedBottle: {
                  name: "12-year-old Island Single Malt",
                  series: null,
                  category: "single_malt",
                  edition: null,
                  statedAge: 12,
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
                    name: "Creag Isle",
                  },
                  distillers: [],
                  bottler: null,
                },
              },
              artifacts: {
                extractedIdentity,
                searchEvidence,
                candidates: [],
                resolvedEntities: [],
              },
            };
          }

          return {
            decision: {
              action: "no_match",
              rationale:
                "No safe local match, and creation was not allowed without web confirmation.",
              candidateBottleIds: [],
              identityScope: "product",
              observation: null,
              matchedBottleId: null,
              proposedBottle: null,
            },
            artifacts: {
              extractedIdentity,
              searchEvidence: [],
              candidates: [],
              resolvedEntities: [],
            },
          };
        },
      );
      const { classifier } = createTestClassifier({
        client: {
          responses: {
            create,
          },
        } as unknown as OpenAI,
        extractedIdentity,
        maxSearchQueries: 1,
        firecrawlApiKey,
        searchBottles,
        runBottleClassifierAgent,
        executeWebSearch,
        observeToolEvent: (event) => toolEvents.push(event),
      });

      const result = await classifier.classifyBottleReference({
        reference: {
          name: "Creag Isle 12-year-old Island Single Malt Scotch Whisky",
          url: "https://www.totalwine.com/spirits/scotch/single-malt/creag-isle-12yr-island-single-malt-scotch-whisky/p/189848750",
        },
      });

      expect(create).not.toHaveBeenCalled();
      expect(executeWebSearch).toHaveBeenCalledOnce();
      expect(executeWebSearch).toHaveBeenCalledWith({
        toolName,
        args: { query: "Creag Isle 12 year old single malt" },
        execute: expect.any(Function),
      });
      expect(toolEvents).toHaveLength(2);
      expect(toolEvents[0]).toMatchObject({
        type: "tool_call",
        phase: "preload",
        name: toolName,
        arguments: { query: "Creag Isle 12 year old single malt" },
      });
      expect(toolEvents[1]).toMatchObject({
        type: "tool_result",
        phase: "preload",
        name: toolName,
        toolCallId:
          toolEvents[0]?.type === "tool_call" ? toolEvents[0].id : undefined,
        result: replayedEvidence,
      });
      expect(searchBottles).toHaveBeenCalledTimes(2);
      expect(searchBottles).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: "Creag Isle 12 year old single malt",
        }),
      );
      expect(runBottleClassifierAgent).toHaveBeenCalledTimes(1);
      expect(runBottleClassifierAgent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          investigationHint: expect.stringContaining("before reasoning"),
          searchEvidence: expect.arrayContaining([
            expect.objectContaining({
              query: "Creag Isle 12 year old single malt",
            }),
          ]),
        }),
      );
      expect(result.status).toBe("classified");
      if (result.status !== "classified") return;
      expect(result.decision).toMatchObject({
        action: "create_bottle",
        proposedBottle: {
          brand: {
            name: "Creag Isle",
          },
          name: "12-year-old Island Single Malt",
        },
      });
    },
  );

  test("uses canonical cask traits to investigate and query an otherwise sparse reference", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Example",
      bottler: null,
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_strength: null,
      single_cask: null,
      cask_type: "pedro_ximenez",
      cask_size: "hogshead",
      cask_fill: "1st_fill",
      edition: null,
    };
    const create = vi.fn().mockResolvedValue({
      output_text:
        "Example Selection uses a first-fill Pedro Ximénez hogshead.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            sources: [
              {
                type: "url",
                url: "https://producer.example/products/selection",
              },
            ],
          },
        },
      ],
    });
    const runBottleClassifierAgent = vi.fn(
      async ({ searchEvidence }): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          rationale: "No safe local match.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: searchEvidence ?? [],
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      client: {
        responses: {
          create,
        },
      } as unknown as OpenAI,
      extractedIdentity,
      maxSearchQueries: 1,
      runBottleClassifierAgent,
    });

    await classifier.classifyBottleReference({
      reference: {
        name: "Example Selection",
        url: "https://shop.example/products/selection",
      },
      initialCandidates: [],
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        searchEvidence: expect.arrayContaining([
          expect.objectContaining({
            query: "Example pedro ximenez hogshead 1st fill",
          }),
        ]),
      }),
    );
  });

  test("does not retry no_match solely because evidence is from a known review domain", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Creag Isle",
      bottler: null,
      expression: null,
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const searchEvidence = [
      createReliableSearchEvidence({
        query: "Creag Isle 12 year old single malt",
        summary:
          "Creag Isle 12 Year Island Single Malt is a 12 year old single malt Scotch whisky.",
      }),
    ];
    const create = vi.fn().mockResolvedValue({
      output_text:
        "Creag Isle 12-year-old Island Single Malt is a 12 year old single malt Scotch whisky.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            sources: [
              {
                type: "url",
                url: "https://distiller.com/spirits/creag-isle-12-year-island-single-malt",
              },
            ],
          },
        },
      ],
    });
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          rationale: "No safe local match.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence,
          candidates: [],
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      client: {
        responses: {
          create,
        },
      } as unknown as OpenAI,
      extractedIdentity,
      maxSearchQueries: 1,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Creag Isle 12-year-old Island Single Malt Scotch Whisky",
        url: "https://www.totalwine.com/spirits/scotch/single-malt/creag-isle-12yr-island-single-malt-scotch-whisky/p/189848750",
      },
      initialCandidates: [],
    });

    expect(runBottleClassifierAgent).toHaveBeenCalledTimes(1);
    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        investigationHint: expect.stringContaining("before reasoning"),
        searchEvidence: expect.arrayContaining([
          expect.objectContaining({
            query: "Creag Isle 12 year old single malt",
          }),
        ]),
      }),
    );
    expect(result.status).toBe("classified");
    if (result.status !== "classified") return;
    expect(result.decision).toMatchObject({
      action: "no_match",
    });
  });

  test("reports metadata for one native reference reasoning call", async () => {
    const runAgent = vi.spyOn(Runner.prototype, "run").mockResolvedValueOnce(
      nativeAgentResult({
        finalOutput: noMatchAgentDecision(),
        inputTokens: 20,
        outputTokens: 5,
        toolNames: ["search_bottles"],
      }) as never,
    );
    const { classifier } = createTestClassifier({ maxSearchQueries: 0 });

    try {
      const run = await classifier.runBottleReference({
        reference: { name: "Example Single Malt Whisky" },
        extractedIdentity: null,
        initialCandidates: [],
      });

      expect(run.result).toMatchObject({
        status: "classified",
        decision: { action: "no_match" },
      });
      expect(run.modelMetadata).toMatchObject({
        agentDurationMs: expect.any(Number),
        usage: {
          requests: 1,
          inputTokens: 20,
          outputTokens: 5,
          totalTokens: 25,
        },
        toolCalls: { count: 1, names: ["search_bottles"] },
      });
    } finally {
      runAgent.mockRestore();
    }
  });

  test("returns null metadata for an override-only reference run", async () => {
    const { classifier } = createTestClassifier({
      runBottleClassifierAgent: async () => ({
        decision: noMatchAgentDecision(),
        artifacts: buildBottleClassificationArtifacts({}),
      }),
    });

    const run = await classifier.runBottleReference({
      reference: { name: "Example Single Malt Whisky" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    expect(run.result).toMatchObject({
      status: "classified",
      decision: { action: "no_match" },
    });
    expect(run.modelMetadata).toBeNull();
  });

  test("falls back to text extraction when image extraction returns null", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({ extractedIdentity }): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "Used the text fallback.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          matchedBottleId: null,
          proposedBottle: {
            name: "Springbank 10 Year Old",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 10,
            caskStrength: null,
            singleCask: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 46,
            vintageYear: null,
            releaseYear: null,
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
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
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
          rationale: "Image failed, text fallback still ran.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
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
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
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

  test("preserves non-exact existing matches selected by the classifier", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "Closest local candidate.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 7,
          candidateBottleIds: [7],
          proposedBottle: null,
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
      action: "match",
      matchedBottleId: 7,
    });
  });

  test("downgrades create_bottle drafts that duplicate surfaced bottle candidates", async () => {
    const springbank10YearOldIdentity: BottleExtractedDetails = {
      brand: "Springbank",
      bottler: null,
      expression: "10-year-old",
      series: null,
      distillery: ["Springbank"],
      category: "single_malt",
      stated_age: 10,
      abv: 46,
      release_year: null,
      vintage_year: null,
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "No local bottle matched the reference.",
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "10-year-old",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 10,
            caskStrength: null,
            singleCask: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 46,
            vintageYear: null,
            releaseYear: null,
            brand: {
              id: null,
              name: "Springbank",
            },
            distillers: [
              {
                id: null,
                name: "Springbank",
              },
            ],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity: springbank10YearOldIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Springbank 10-year-old",
              summary: "Springbank 10-year-old single malt whisky.",
            }),
          ],
          candidates: initialCandidates,
          resolvedEntities: [],
        },
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: springbank10YearOldIdentity,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "Springbank 10-year-old",
        url: "https://example.com/products/springbank-10",
      },
      extractedIdentity: springbank10YearOldIdentity,
      initialCandidates: [springbank10YearOldCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      candidateBottleIds: [springbank10YearOldCandidate.bottleId],
      matchedBottleId: null,
      proposedBottle: null,
    });
    expect(result.decision.rationale).toContain(
      "exact existing Bottle candidate may already cover",
    );
  });

  test("does not invent a branded bottle from sparse generic batch wording", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
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
          candidateBottleIds: [],
          proposedBottle: {
            name: "Blenders' Sherry Cask Finish EXP#7 12-year-old 2018 Release",
            series: {
              id: null,
              name: "Blenders' Batch",
            },
            category: "blend",
            edition: "EXP#7",
            statedAge: 12,
            caskStrength: false,
            singleCask: false,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 40,
            vintageYear: null,
            releaseYear: 2018,
            brand: {
              id: null,
              name: "Johnnie Walker",
            },
            distillers: [],
            bottler: null,
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
    });
    expect(result.decision.rationale).toContain(
      "expanded too far beyond a sparse unanchored reference",
    );
  });

  test("keeps a matched bottle when the only name difference is a canonical proof suffix", async () => {
    const rareBreedRyeMatch: BottleCandidate = {
      bottleId: 501,
      alias: null,
      fullName: "Wild Turkey Rare Breed Rye Barrel Proof",
      brand: "Wild Turkey",
      bottler: null,
      series: "Rare Breed",
      distillery: [],
      category: "rye",
      statedAge: null,
      edition: null,
      caskStrength: true,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: 56.1,
      vintageYear: null,
      releaseYear: null,
      score: 0.93,
      source: ["text"],
    };
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "Recovered the exact Rare Breed Rye bottle.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 501,
          candidateBottleIds: [501],
          proposedBottle: null,
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

  test("moves an auto-verification match to review when the decision reports unresolved risks", async () => {
    const rareBreedRyeMatch: BottleCandidate = {
      bottleId: 501,
      alias: null,
      fullName: "Wild Turkey Rare Breed Rye Barrel Proof",
      brand: "Wild Turkey",
      bottler: null,
      series: "Rare Breed",
      distillery: [],
      category: "rye",
      statedAge: null,
      edition: null,
      caskStrength: true,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: 56.1,
      vintageYear: null,
      releaseYear: null,
      score: 0.93,
      source: ["text"],
    };
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "Recovered the Rare Breed Rye bottle.",
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: ["Local search found the rye sibling."],
            unresolvedRisks: [
              {
                category: "web_evidence_conflict",
                note: "The source omits the barrel-proof wording on the canonical bottle.",
              },
            ],
            toolsUsed: ["initial_local_candidates"],
            webEvidence: "not_needed",
          },
          matchedBottleId: 501,
          candidateBottleIds: [501],
          proposedBottle: null,
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

  test("moves an auto-verification match to review when replacing a current assignment", async () => {
    const rareBreedRyeMatch: BottleCandidate = {
      bottleId: 501,
      alias: null,
      fullName: "Wild Turkey Rare Breed Rye Barrel Proof",
      brand: "Wild Turkey",
      bottler: null,
      series: "Rare Breed",
      distillery: [],
      category: "rye",
      statedAge: null,
      edition: null,
      caskStrength: true,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: 56.1,
      vintageYear: null,
      releaseYear: null,
      score: 0.93,
      source: ["text"],
    };
    const runBottleClassifierAgent = vi.fn(
      async ({ initialCandidates }): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "Recovered the Rare Breed Rye bottle.",
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: ["Local search found the rye sibling."],
            unresolvedRisks: [],
            toolsUsed: ["initial_local_candidates"],
            webEvidence: "not_needed",
          },
          matchedBottleId: 501,
          candidateBottleIds: [501],
          proposedBottle: null,
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
        currentBottleId: 500,
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

  test("does not preserve a guessed house category for unsupported malt whiskey styles", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Woodford Reserve",
      bottler: null,
      expression: "Kentucky Straight Malt",
      series: null,
      distillery: ["Woodford Reserve"],
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
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "Woodford Reserve Kentucky Straight Malt Whiskey exists.",
          identityScope: "product",
          observation: null,
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Malt Whiskey",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "Woodford Reserve",
            },
            distillers: [
              {
                id: null,
                name: "Woodford Reserve",
              },
            ],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Woodford Reserve Kentucky Straight Malt Whiskey",
              summary:
                "Woodford Reserve Kentucky Straight Malt Whiskey is a distinct Woodford Reserve malt whiskey.",
            }),
          ],
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
        name: "Woodford Reserve Kentucky Straight Malt Whiskey",
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
      proposedBottle: {
        name: "Kentucky Straight Malt Whiskey",
        category: null,
      },
    });
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale:
            "The generic 12-year-old local bottle is the safest match.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 65001,
          candidateBottleIds: [65001, 65002, 65003],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            tomatinLegacy12Candidate,
            tomatinBourbonAndSherryCasksCandidate,
            tomatinCaskStrengthCandidate,
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
        tomatinCaskStrengthCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 65001,
      identityScope: "product",
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The local alias is an exact wording match.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 11,
          candidateBottleIds: [11],
          proposedBottle: null,
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
    });
    expect(result.decision.proposedBottle).toBeNull();
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The local bottle identity matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 43236,
          candidateBottleIds: [43236],
          proposedBottle: null,
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale:
            "The local bottle aligns on brand, distillery, category, and the distinctive expression name.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 41258,
          candidateBottleIds: [41258, 41259],
          proposedBottle: null,
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale:
            "The local bottle aligns on the Jura brand family, category, and the 12-year-old age-statement core bottling.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 3233,
          candidateBottleIds: [3233, 4306],
          proposedBottle: null,
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale:
            "The 9-year Reserve bottle is the strongest existing match, and Triple Aged reads as extra label wording rather than a separate product family.",
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: [
              "Official web evidence supports Canadian Club Reserve 9 Year Old.",
            ],
            unresolvedRisks: [
              {
                category: "sibling_ambiguity",
                note: "A broader sibling omits the age statement.",
              },
            ],
            toolsUsed: ["openai_web_search"],
            webEvidence: "supportive",
          },
          matchedBottleId: 16913,
          candidateBottleIds: [16913, 17346],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Canadian Club Reserve 9-year-old",
              summary: "Canadian Club Reserve 9 Year Old is a Canadian whisky.",
            }),
          ],
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
      matchedBottleId: 16913,
      identityScope: "product",
      confidenceBasis: {
        unresolvedRisks: [
          {
            category: "sibling_ambiguity",
            note: "A broader sibling omits the age statement.",
          },
        ],
      },
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("preserves bottle creation instead of rewriting it to a structured local match", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "Web evidence supports Canadian Club Reserve 9-year-old.",
          identityScope: "product",
          observation: null,
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          candidateBottleIds: [17346],
          proposedBottle: {
            name: "Reserve",
            series: null,
            category: "blend",
            edition: null,
            statedAge: 9,
            caskStrength: null,
            singleCask: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 40,
            vintageYear: null,
            releaseYear: null,
            brand: {
              id: null,
              name: "Canadian Club",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Canadian Club Reserve 9-year-old",
              summary: "Canadian Club Reserve 9 Year Old is a Canadian whisky.",
            }),
          ],
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
      action: "create_bottle",
      matchedBottleId: null,
      identityScope: "product",
      proposedBottle: {
        name: "Reserve 9-year-old",
        statedAge: 9,
      },
    });
  });

  test("preserves a plain age parent match when cask wording is not an extracted field conflict", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale:
            "The local Jura 12-year-old bottle appears close to the listing.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 3233,
          candidateBottleIds: [3233, 3234],
          proposedBottle: null,
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
      action: "match",
      matchedBottleId: 3233,
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("does not redirect duplicate bottle creation to a child release under an exact local parent", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: "Batch 1",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "Web evidence supports a specific Rare Cask Release bottling.",
          identityScope: "exact_cask",
          observation: {
            selector: null,
            caskNumber: "1803",
            barrelNumber: null,
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          candidateBottleIds: [2457],
          proposedBottle: {
            name: "1978 Rare Cask Release",
            series: {
              id: null,
              name: "Rare Cask Release",
            },
            category: "single_malt",
            edition: "Batch 1",
            statedAge: 35,
            caskStrength: null,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 42.9,
            vintageYear: 1978,
            releaseYear: null,
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
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Glenglassaugh 1978 Rare Cask Release Batch 1",
              summary:
                "Glenglassaugh 1978 Rare Cask Release Batch 1 is a 35-year-old single malt.",
            }),
          ],
          candidates: [glenglassaughRareCaskCandidate],
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
      initialCandidates: [glenglassaughRareCaskCandidate],
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

  test("downgrades a dirty parent age match instead of redirecting it to a child release", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: "Batch 1",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale:
            "The exact local parent matches but has a conflicting structured age.",
          identityScope: "product",
          observation: null,
          confidenceBasis: {
            positiveEvidence: ["The exact local parent covers the family."],
            unresolvedRisks: [
              {
                category: "trait_conflict",
                note: "Age conflict between source and matched bottle record.",
              },
            ],
            toolsUsed: ["initial_local_candidates"],
            webEvidence: "not_used",
          },
          matchedBottleId: 2457,
          candidateBottleIds: [2457],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [glenglassaughRareCaskCandidate],
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
      initialCandidates: [glenglassaughRareCaskCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "no_match",
      identityScope: "product",
      matchedBottleId: null,
    });
    expect(result.decision.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps non-SMWS year-marked creation on one complete Bottle", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Talisker",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Talisker"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: 2001,
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "Web evidence found a 2001 vintage and 2012 bottling year.",
          identityScope: "exact_cask",
          observation: null,
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "2001 The Distillers Edition",
            series: {
              id: null,
              name: "The Distillers Edition",
            },
            category: "single_malt",
            edition: null,
            statedAge: 10,
            caskStrength: null,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 45.8,
            vintageYear: 2001,
            releaseYear: 2012,
            brand: {
              id: null,
              name: "Talisker",
            },
            distillers: [
              {
                id: null,
                name: "Talisker",
              },
            ],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Talisker Distillers Edition 2001 2012",
              summary:
                "Talisker Distillers Edition 2001 was distilled in 2001 and bottled in 2012.",
            }),
          ],
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
        name: "Talisker 2001 The Distillers Edition",
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
      proposedBottle: {
        name: "The Distillers Edition",
        brand: {
          name: "Talisker",
        },
        vintageYear: 2001,
        releaseYear: 2012,
      },
    });
  });

  test("preserves exact-cask age and vintage in standalone bottle display names", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "The Exclusive Malts",
      bottler: "Creative Whisky Company",
      expression: "Islay",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 8,
      abv: 57.1,
      release_year: 2016,
      vintage_year: 2007,
      cask_strength: true,
      single_cask: true,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "The label supports this as a standalone single-cask bottling.",
          identityScope: "exact_cask",
          observation: {
            selector: null,
            caskNumber: "1661",
            barrelNumber: null,
            bottleNumber: null,
            outturn: 312,
            market: null,
            exclusive: null,
          },
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Islay",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 8,
            caskStrength: true,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 57.1,
            vintageYear: 2007,
            releaseYear: 2016,
            brand: {
              id: null,
              name: "The Exclusive Malts",
            },
            distillers: [],
            bottler: {
              id: null,
              name: "Creative Whisky Company",
            },
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
        name: "The Exclusive Malts Islay 8 year old 2007",
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
        name: "Islay 8-year-old",
        statedAge: 8,
        vintageYear: 2007,
      },
    });
  });

  test("keeps an exact-cask marker structured outside the stable bottle name", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Willett",
      bottler: null,
      expression: "Family Estate Bottled Single Barrel Bourbon",
      series: "Family Estate Bottled",
      distillery: ["Willett"],
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
      edition: "Barrel No. 4769",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "The label identifies one exact single-barrel Bottle.",
          identityScope: "exact_cask",
          observation: {
            selector: null,
            caskNumber: "4769",
            barrelNumber: "4769",
            bottleNumber: null,
            outturn: null,
            market: null,
            exclusive: null,
          },
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Family Estate Bottled Single Barrel Bourbon",
            series: { id: null, name: "Family Estate Bottled" },
            category: "bourbon",
            edition: "Barrel No. 4769",
            statedAge: 5,
            caskStrength: true,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 64.2,
            vintageYear: null,
            releaseYear: null,
            brand: { id: null, name: "Willett" },
            distillers: [{ id: null, name: "Willett" }],
            bottler: null,
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
      reference: { name: "Willett Family Estate Barrel No. 4769" },
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
        name: "Family Estate Bottled Single Barrel Bourbon 5-year-old",
        edition: "Barrel No. 4769",
      },
    });
  });

  test("preserves a more specific batch-A match selected by the classifier", async () => {
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
      cask_strength: true,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The local candidate looks close to the listing.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 9101,
          candidateBottleIds: [9101],
          proposedBottle: null,
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
      action: "match",
      matchedBottleId: 9101,
    });
    expect(result.decision.rationale).not.toContain(
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The local bottle identity matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          candidateBottleIds: [44006],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [lagavulinDistillersEditionBaseCandidate],
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
      initialCandidates: [lagavulinDistillersEditionBaseCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps an exact Bottle match when official evidence only mentions the brand in possessive summary text", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The existing 2023 Bottle matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          candidateBottleIds: [44006],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            {
              provider: "openai",
              query: '"Lagavulin Distillers Edition 2023"',
              summary:
                "Lagavulin's official site lists the Distillers Edition 2023 Bottle.",
              results: [
                {
                  title:
                    "Distillers Edition 2023 Release | Official Product Page",
                  url: "https://www.lagavulin.com/en-us/whiskies/distillers-edition-2023",
                  domain: "lagavulin.com",
                  description:
                    "Official product page for the Distillers Edition 2023 Bottle.",
                  extraSnippets: [],
                },
              ],
            },
          ],
          candidates: [
            lagavulinDistillersEditionBaseCandidate,
            lagavulinDistillersEdition2023Candidate,
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
        lagavulinDistillersEditionBaseCandidate,
        lagavulinDistillersEdition2023Candidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("does not require supportive web evidence for a classifier-selected existing match", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The broader Bottle is the closest local candidate.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          candidateBottleIds: [44006],
          proposedBottle: null,
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
          candidates: [lagavulinDistillersEditionBaseCandidate],
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
      initialCandidates: [lagavulinDistillersEditionBaseCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps a uniquely supported annual Bottle match without web evidence", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The existing 2023 Bottle matches the listing cleanly.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          candidateBottleIds: [44006],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            lagavulinDistillersEditionBaseCandidate,
            lagavulinDistillersEdition2023Candidate,
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
        lagavulinDistillersEditionBaseCandidate,
        lagavulinDistillersEdition2023Candidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
      identityScope: "product",
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("preserves an annual Bottle match selected by the classifier when siblings share a bare year", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "One of the 2023 Bottles appears to match the listing.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 44006,
          candidateBottleIds: [44006],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            lagavulinDistillersEditionBaseCandidate,
            lagavulinDistillersEdition2023SpringCandidate,
            lagavulinDistillersEdition2023AutumnCandidate,
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
        lagavulinDistillersEditionBaseCandidate,
        lagavulinDistillersEdition2023SpringCandidate,
        lagavulinDistillersEdition2023AutumnCandidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 44006,
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("preserves a base Bottle match selected by the classifier when a more specific Bottle candidate is available", async () => {
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
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: "Batch 4",
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "match",
          rationale: "The broader Bottle is the closest local match.",
          identityScope: "product",
          observation: null,
          matchedBottleId: 13442,
          candidateBottleIds: [13442],
          proposedBottle: null,
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [
            cadbollEstateBaseCandidate,
            cadbollEstateBatch4Candidate,
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
        cadbollEstateBaseCandidate,
        cadbollEstateBatch4Candidate,
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 13442,
    });
    expect(result.decision.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
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
      cask_strength: null,
      single_cask: true,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale: "This is marketed as a standalone single-cask bottle.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          proposedBottle: {
            name: "6.71",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 61.2,
            vintageYear: null,
            releaseYear: null,
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
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "SMWS 6.71",
              summary:
                "The Scotch Malt Whisky Society 6.71 is a Macduff single cask bottle at 61.2% ABV.",
            }),
          ],
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
      brand: "Example",
      bottler: null,
      expression: "Single Barrel",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: null,
      abv: 50,
      release_year: null,
      vintage_year: null,
      cask_strength: null,
      single_cask: true,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "This is a bottle-level product, but the reference does not identify a specific cask.",
          candidateBottleIds: [],
          identityScope: "exact_cask",
          observation: null,
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          proposedBottle: {
            name: "Single Barrel",
            series: null,
            category: "bourbon",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 50,
            vintageYear: null,
            releaseYear: null,
            brand: {
              id: null,
              name: "Example",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Example Single Barrel",
              summary:
                "Example Single Barrel is a bourbon bottle-level product at 50% ABV.",
            }),
          ],
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
        name: "Example Single Barrel",
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
      cask_strength: true,
      single_cask: true,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "create_bottle",
          rationale:
            "This is a barrel-strength single-barrel bourbon, not a numbered exact-cask program bottle.",
          candidateBottleIds: [],
          identityScope: null,
          observation: null,
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          matchedBottleId: null,
          proposedBottle: {
            name: "Example Single Barrel 58.4",
            series: null,
            category: "bourbon",
            edition: null,
            statedAge: null,
            caskStrength: true,
            singleCask: true,
            caskType: null,
            caskSize: null,
            caskFill: null,
            abv: 58.4,
            vintageYear: null,
            releaseYear: null,
            brand: {
              id: null,
              name: "Example",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [
            createReliableSearchEvidence({
              query: "Example Single Barrel 58.4",
              summary:
                "Example Single Barrel 58.4 is a barrel strength single barrel bourbon bottle-level product.",
            }),
          ],
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

  test("passes deterministic SMWS creation through the agent as an identity anchor", async () => {
    const extractFromText = vi.fn(async (): Promise<BottleExtractedDetails> => {
      throw new Error(
        "SMWS deterministic references should not need extraction",
      );
    });
    const runBottleClassifierAgent = vi.fn(
      async ({
        identityAnchor,
        initialCandidates,
      }): Promise<ReasoningResult> => ({
        decision: identityAnchor ?? noMatchAgentDecision(),
        artifacts: buildBottleClassificationArtifacts({
          candidates: initialCandidates,
        }),
      }),
    );
    const { classifier } = createTestClassifier({
      extractFromText,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
      },
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "create_bottle",
      identityScope: "exact_cask",
      proposedBottle: {
        name: "RW6.5 Sauna Smoke",
        category: "rye",
        singleCask: true,
        caskType: null,
        caskSize: null,
        caskFill: null,
        distillers: [
          {
            name: "Kyrö",
          },
        ],
      },
      observation: {
        selector: "Sauna Smoke",
        caskNumber: "RW6.5",
      },
      confidenceBasis: {
        webEvidence: "not_needed",
      },
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledOnce();
    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        identityAnchor: expect.objectContaining({
          action: "create_bottle",
          identityScope: "exact_cask",
        }),
      }),
    );
    expect(extractFromText).not.toHaveBeenCalled();
  });

  test("passes image evidence through to classifier agent overrides", async () => {
    const imageEvidence = {
      sourceImageId: "pending-upload-1",
      extractors: [
        {
          kind: "ocr" as const,
          confidence: 0.86,
          textSpans: [{ text: "Ardbeg Uigeadail", confidence: 0.91 }],
          observations: [],
        },
      ],
      fieldCandidates: {
        brand: { value: "Ardbeg", confidence: 0.96 },
      },
      photoSuitability: {
        isSingleBottlePhoto: true,
        labelReadable: true,
        suitableAsTastingImage: true,
        suitableAsBottleImage: true,
      },
      conflicts: [],
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          rationale: "Needs user confirmation.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
        },
        artifacts: buildBottleClassificationArtifacts({ imageEvidence }),
      }),
    );
    const { classifier } = createTestClassifier({
      extractedIdentity: {
        brand: "Ardbeg",
        bottler: null,
        expression: "Uigeadail",
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
        edition: null,
      },
      runBottleClassifierAgent,
    });

    await classifier.classifyBottleReference({
      reference: {
        name: "Ardbeg Uigeadail",
      },
      imageEvidence,
      candidateExpansion: "initial_only",
    });

    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        imageEvidence,
      }),
    );
  });

  test("passes a deterministic SMWS match through the agent as an identity anchor", async () => {
    const existingSmwsBottle: BottleCandidate = {
      bottleId: 6505,
      alias: "SMWS RW6.5 Appley ever after",
      fullName: "SMWS RW6.5 Appley ever after",
      brand: "SMWS",
      bottler: "The Scotch Malt Whisky Society",
      series: null,
      distillery: ["Kyrö"],
      category: "rye",
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
      score: 0.99,
      source: ["exact"],
    };
    const runBottleClassifierAgent = vi.fn(
      async ({
        identityAnchor,
        initialCandidates,
      }): Promise<ReasoningResult> => ({
        decision: identityAnchor ?? noMatchAgentDecision(),
        artifacts: buildBottleClassificationArtifacts({
          candidates: initialCandidates,
        }),
      }),
    );
    const getBottleContext = vi.fn(async () => null);
    const { classifier } = createTestClassifier({
      getBottleContext,
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
      },
      initialCandidates: [existingSmwsBottle],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      identityScope: "exact_cask",
      matchedBottleId: 6505,
      observation: {
        selector: "Sauna Smoke",
        caskNumber: "RW6.5",
      },
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        identityAnchor: expect.objectContaining({
          action: "match",
          matchedBottleId: 6505,
        }),
      }),
    );
    expect(getBottleContext).not.toHaveBeenCalled();
  });

  test("keeps bare SMWS code references anchored to the code", async () => {
    const runBottleClassifierAgent = vi.fn(
      async ({ identityAnchor }): Promise<ReasoningResult> => ({
        decision: identityAnchor ?? noMatchAgentDecision(),
        artifacts: buildBottleClassificationArtifacts({}),
      }),
    );
    const { classifier } = createTestClassifier({
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "SMWS 6.53",
      },
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
        category: "single_malt",
        edition: null,
        singleCask: true,
        caskType: null,
        caskSize: null,
        caskFill: null,
        distillers: [
          {
            name: "Macduff",
          },
        ],
      },
      observation: {
        selector: null,
        caskNumber: "6.53",
      },
    });
    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        identityAnchor: expect.objectContaining({
          action: "create_bottle",
          identityScope: "exact_cask",
        }),
      }),
    );
  });

  test("does not treat SMWS ABV values as deterministic cask codes", async () => {
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "no_match",
          rationale: "ABV lookalikes need agent review.",
          candidateBottleIds: [],
          identityScope: "product",
          observation: null,
          matchedBottleId: null,
          proposedBottle: null,
        },
        artifacts: buildBottleClassificationArtifacts({}),
      }),
    );
    const { classifier } = createTestClassifier({
      runBottleClassifierAgent,
    });

    const result = await classifier.classifyBottleReference({
      reference: {
        name: "SMWS single cask 54.2% ABV",
      },
      extractedIdentity: {
        brand: "SMWS",
        bottler: "The Scotch Malt Whisky Society",
        expression: null,
        series: null,
        distillery: [],
        category: "single_malt",
        stated_age: null,
        abv: 54.2,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: true,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: "54.2",
      },
      initialCandidates: [],
    });

    expect(result.status).toBe("classified");
    expect(runBottleClassifierAgent).toHaveBeenCalledOnce();
  });

  test("normalizes a legacy generic-category repair into a plain existing match", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "Shibui",
      bottler: null,
      expression: "Grain Select",
      series: null,
      distillery: [],
      category: "single_grain",
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
    };
    const shibuiGrainSelectCandidate: BottleCandidate = {
      bottleId: 13025,
      alias: "Shibui Grain Select",
      fullName: "Shibui Grain Select",
      brand: "Shibui",
      bottler: null,
      series: null,
      distillery: [],
      category: "spirit",
      statedAge: null,
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
      source: ["brand", "exact"],
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "repair_bottle",
          rationale:
            "The exact local bottle matches, but the stored category is generic.",
          candidateBottleIds: [13025],
          identityScope: "product",
          observation: null,
          matchedBottleId: 13025,
          proposedBottle: {
            name: "Grain Select",
            series: null,
            category: "single_grain",
            edition: null,
            statedAge: null,
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
              name: "Shibui",
            },
            distillers: [],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [shibuiGrainSelectCandidate],
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
        name: "Shibui Grain Select Whisky 750ml",
      },
      extractedIdentity,
      initialCandidates: [shibuiGrainSelectCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "match",
      matchedBottleId: 13025,
      proposedBottle: null,
      identityScope: "product",
    });
  });

  test("keeps first-class same-bottle repair decisions", async () => {
    const extractedIdentity: BottleExtractedDetails = {
      brand: "The Whistler",
      bottler: null,
      expression: "Bodega Cask",
      series: null,
      distillery: ["Boann Distillery"],
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
    };
    const currentBottleCandidate: BottleCandidate = {
      bottleId: 1201,
      alias: "The Whistler Bodega Cask",
      fullName: "The Whistler Bodega Cask",
      brand: "The Whistler",
      bottler: null,
      series: null,
      distillery: [],
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
      releaseYear: null,
      score: 0.99,
      source: ["exact"],
    };
    const runBottleClassifierAgent = vi.fn(
      async (): Promise<ReasoningResult> => ({
        decision: {
          action: "repair_bottle",
          rationale:
            "The bottle identity matches, but the stored distillery and category are wrong.",
          candidateBottleIds: [currentBottleCandidate.bottleId],
          identityScope: "product",
          observation: null,
          matchedBottleId: currentBottleCandidate.bottleId,
          proposedBottle: {
            name: "Bodega Cask",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
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
              name: "The Whistler",
            },
            distillers: [
              {
                id: null,
                name: "Boann Distillery",
              },
            ],
            bottler: null,
          },
        },
        artifacts: {
          extractedIdentity,
          searchEvidence: [],
          candidates: [currentBottleCandidate],
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
        name: "The Whistler Bodega Cask Single Malt",
      },
      extractedIdentity,
      initialCandidates: [currentBottleCandidate],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }

    expect(result.decision).toMatchObject({
      action: "repair_bottle",
      matchedBottleId: currentBottleCandidate.bottleId,
      proposedBottle: {
        name: "Bodega Cask",
        category: "single_malt",
        distillers: [
          {
            name: "Boann Distillery",
          },
        ],
      },
    });
  });
});
