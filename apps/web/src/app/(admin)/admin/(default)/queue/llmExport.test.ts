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

function queueItem(): QueueItem {
  const item = {
    id: 99,
    status: "pending_review",
    proposalType: "match_existing",
    creationTarget: null,
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
    parentBottleId: null,
    parentBottle: null,
    proposedBottle: null,
    proposedRelease: null,
    candidateBottles: [],
    webEvidenceChecks: [],
    searchEvidence: [],
  } satisfies Partial<QueueItem>;

  return item as QueueItem;
}

describe("formatPriceMatchQueueLlmExport", () => {
  it("exports direct Bottle identities without target authority", () => {
    const payload = JSON.parse(formatPriceMatchQueueLlmExport(queueItem()));

    expect(payload.schemaVersion).toBe(3);
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
  });
});
