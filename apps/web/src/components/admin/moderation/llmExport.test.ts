import type { Outputs } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

import { formatPriceMatchQueueLlmExport } from "./llmExport";

type QueueItem = Outputs["prices"]["matchQueue"]["details"];
type QueueBottle = NonNullable<QueueItem["suggestedBottle"]>;

const timestamp = "2026-07-21T00:00:00.000Z";
const brand = {
  id: 1,
  peatedId: "E0001",
  name: "Springbank",
  shortName: null,
  kind: "brand",
  ownerId: null,
  description: null,
  descriptionSrc: null,
  yearEstablished: null,
  website: null,
  country: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 0,
  totalBottles: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies QueueBottle["brand"];

const suggestedBottle = {
  id: 19,
  peatedId: "B0019",
  fullName: "Springbank 12 Cask Strength Batch 24",
  name: "12 Cask Strength Batch 24",
  brand,
  series: null,
  category: "single_malt",
  distillers: [],
  bottler: null,
  edition: "Batch 24",
  statedAge: 12,
  abv: 57.8,
  caskStrength: true,
  singleCask: false,
  naturalColor: null,
  nonChillFiltered: null,
  maltPhenolPpm: null,
  noAgeStatement: null,
  vintageYear: null,
  bottlingYear: null,
  releaseYear: 2024,
  releaseDate: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
  description: null,
  descriptionSrc: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  avgScore: null,
  totalScores: 0,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 0,
    total: 0,
    avg: null,
    percentage: { pass: 0, sip: 0, savor: 0 },
  },
  totalTastings: 0,
  imageUrl: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies QueueBottle;

const localCandidate = {
  bottleId: 19,
  alias: "Springbank Batch 24",
  fullName: "Springbank 12 Cask Strength Batch 24",
  brand: "Springbank",
  bottler: null,
  series: null,
  distillery: ["Springbank"],
  category: "single_malt",
  statedAge: 12,
  edition: "Batch 24",
  caskStrength: true,
  singleCask: false,
  maturation: null,
  caskNumber: null,
  outturn: null,
  abv: 57.8,
  vintageYear: null,
  releaseYear: 2024,
  score: 0.93,
  source: ["vector"],
} satisfies QueueItem["candidateBottles"][number];

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 99,
    status: "pending_review",
    proposalType: "no_match",
    confidence: 0.98,
    modelConfidence: 0.98,
    model: "test-model",
    rationale: "The available evidence was inconclusive.",
    error: null,
    isProcessing: false,
    automationScore: 0.95,
    automationEligible: false,
    automationBlockers: [],
    decisiveMatchAttributes: [],
    plainAgeBottleAutoVerifyEligible: false,
    differentiatingAttributes: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    lastEvaluatedAt: null,
    reviewedAt: null,
    processingQueuedAt: null,
    processingExpiresAt: null,
    price: {
      id: 12,
      name: "Springbank 12 Cask Strength Batch 24",
      externalProductId: null,
      barcode: null,
      price: 150,
      currency: "usd",
      volume: 750,
      url: "https://example.com/bottle",
      imageUrl: null,
      isValid: true,
      bottle: null,
      updatedAt: timestamp,
      site: {
        id: 3,
        name: "Example",
        type: "totalwine",
        lastRunAt: null,
        nextRunAt: null,
        runEvery: null,
      },
    },
    extractedLabel: null,
    currentBottle: null,
    suggestedBottle,
    proposedBottle: null,
    candidateBottles: [localCandidate],
    webEvidenceChecks: [],
    searchEvidence: [],
    ...overrides,
  } satisfies QueueItem;
}

describe("formatPriceMatchQueueLlmExport", () => {
  it("exports the structured context needed to debug an inconclusive match", () => {
    const payload = JSON.parse(formatPriceMatchQueueLlmExport(queueItem()));

    expect(payload).toMatchObject({
      schemaVersion: 4,
      source: "peated.admin.match_queue",
      proposal: {
        id: 99,
        proposalType: "no_match",
        rationale: "The available evidence was inconclusive.",
      },
      sourceListing: {
        id: 12,
        name: "Springbank 12 Cask Strength Batch 24",
      },
      recommendation: {
        suggestedBottle: {
          id: 19,
          fullName: "Springbank 12 Cask Strength Batch 24",
        },
      },
      artifacts: { localCandidates: [localCandidate] },
    });
  });
});
