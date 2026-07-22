import type { Outputs } from "@peated/server/orpc/router";
import type { CatalogTargetV1 } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";

import { formatPriceMatchQueueLlmExport } from "./llmExport";

type QueueItem = Outputs["prices"]["matchQueue"]["list"]["results"][number];

const genericTarget = {
  kind: "group",
  targetId: 41,
  group: { id: 7, fullName: "Springbank 12 Cask Strength" },
} as CatalogTargetV1;

const exactTarget = {
  kind: "bottle",
  targetId: 42,
  group: genericTarget.group,
  bottle: {
    id: 19,
    fullName: "Springbank 12 Cask Strength Batch 24",
  },
} as CatalogTargetV1;

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
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
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
      target: genericTarget,
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
    currentTarget: genericTarget,
    suggestedTarget: exactTarget,
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
  it("exports authoritative target identities without legacy pair authority", () => {
    const payload = JSON.parse(formatPriceMatchQueueLlmExport(queueItem()));

    expect(payload.schemaVersion).toBe(2);
    expect(payload.currentAssignment).toEqual(genericTarget);
    expect(payload.recommendation.suggestedTarget).toEqual(exactTarget);
    expect(payload.proposal).not.toHaveProperty("currentBottleId");
    expect(payload.proposal).not.toHaveProperty("currentReleaseId");
    expect(payload.proposal).not.toHaveProperty("suggestedBottleId");
    expect(payload.proposal).not.toHaveProperty("suggestedReleaseId");
  });
});
