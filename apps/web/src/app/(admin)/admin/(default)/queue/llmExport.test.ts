import type { Outputs } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

import { formatPriceMatchQueueLlmExport } from "./llmExport";

type QueueItem = Outputs["prices"]["matchQueue"]["list"]["results"][number];
type QueueBottle = NonNullable<QueueItem["suggestedBottle"]>;

const timestamp = "2026-07-21T00:00:00.000Z";
const brand = {
  id: 1,
  name: "Springbank",
  shortName: null,
  type: ["brand"],
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
  vintageYear: null,
  releaseYear: 2024,
  caskType: null,
  caskSize: null,
  caskFill: null,
  description: null,
  descriptionSrc: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
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
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: 57.8,
  vintageYear: null,
  releaseYear: 2024,
  score: 0.93,
  source: ["vector"],
} satisfies QueueItem["candidateBottles"][number];

const proposedBottle = {
  name: "12 Cask Strength Batch 25",
  brand: { id: 1, name: "Springbank" },
  series: null,
  category: "single_malt",
  distillers: [{ id: 2, name: "Springbank Distillery" }],
  bottler: null,
  edition: "Batch 25",
  statedAge: 12,
  abv: 56.5,
  caskStrength: true,
  singleCask: false,
  vintageYear: null,
  releaseYear: 2025,
  caskType: null,
  caskSize: null,
  caskFill: null,
} satisfies NonNullable<QueueItem["proposedBottle"]>;

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  const item = {
    id: 99,
    status: "pending_review",
    proposalType: "match_existing",
    confidence: 0.98,
    modelConfidence: 0.98,
    model: "test-model",
    rationale: "Identity fields agree.",
    error: null,
    isProcessing: false,
    automationScore: 0.95,
    automationEligible: true,
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
      price: 150,
      currency: "usd",
      volume: 750,
      url: "https://example.com/bottle",
      imageUrl: null,
      isValid: true,
      bottle: null,
      updatedAt: "2026-07-21T00:00:00.000Z",
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
  } satisfies Partial<QueueItem>;

  return item as QueueItem;
}

describe("formatPriceMatchQueueLlmExport", () => {
  it("exports direct Bottle identities without target authority", () => {
    const payload = JSON.parse(formatPriceMatchQueueLlmExport(queueItem()));

    expect(payload.schemaVersion).toBe(4);
    expect(payload.currentAssignment).toBeNull();
    expect(payload.recommendation.suggestedBottle).toMatchObject({
      id: 19,
      fullName: "Springbank 12 Cask Strength Batch 24",
      edition: "Batch 24",
    });
    expect(payload.recommendation).not.toHaveProperty("suggestedTarget");
    expect(payload.proposal).not.toHaveProperty("currentBottleId");
    expect(payload.proposal).not.toHaveProperty("currentReleaseId");
    expect(payload.proposal).not.toHaveProperty("suggestedBottleId");
    expect(payload.proposal).not.toHaveProperty("suggestedReleaseId");
    expect(payload.proposal).not.toHaveProperty("creationTarget");
    expect(payload.recommendation).toMatchObject({
      proposedBottle: null,
    });
    expect(payload.recommendation).not.toHaveProperty("createDraft");
    expect(payload.artifacts.localCandidates).toEqual([localCandidate]);
  });

  it("exports one independently complete proposed Bottle", () => {
    const payload = JSON.parse(
      formatPriceMatchQueueLlmExport(
        queueItem({
          proposalType: "create_new",
          suggestedBottle: null,
          proposedBottle,
        }),
      ),
    );

    expect(payload.recommendation).toEqual({
      suggestedBottle: null,
      proposedBottle,
    });
  });
});
