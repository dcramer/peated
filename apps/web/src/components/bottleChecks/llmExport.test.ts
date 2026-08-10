import type { Outputs } from "@peated/server/orpc/router";
import { expect, test } from "vitest";
import { formatBottleCheckOperationLlmExport } from "./llmExport";

type BottleCheckDetails = Outputs["audits"]["details"];

test("formats one Bottle operation with its check context and live review", () => {
  const operation = {
    id: 17,
    checkId: 9,
    proposal: {
      type: "update_entity",
      input: { entityId: 42, patch: { name: "Correct Brand" } },
      rationale: "The inspected evidence supports this change.",
      evidenceRefs: [{ kind: "entity", entityId: 42 }],
    },
    status: "pending_review",
  } as BottleCheckDetails["audit"]["operations"][number];
  const check = {
    id: 9,
    intent: "audit_bottle",
    origin: "moderator",
    sourceKind: null,
    sourceId: null,
    bottleId: 44,
    schemaSupported: true,
    schemaVersion: 2,
    output: { summary: "Review the proposed catalog work.", findings: [] },
    model: "test-model",
    modelMetadata: null,
    error: null,
    storePriceMatchProposalId: null,
    storePriceMatchAttemptId: null,
    closedById: null,
    closeReason: null,
    closeNote: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    completedAt: "2026-07-30T00:01:00.000Z",
    closedAt: null,
    operations: [operation],
  } as BottleCheckDetails["audit"];
  const liveReview = {
    operationId: 17,
    approvalReady: true,
    review: { id: 17, status: "pending_review" },
  } as BottleCheckDetails["reviewOperations"][number];

  const payload = JSON.parse(
    formatBottleCheckOperationLlmExport({
      check,
      liveReview,
      operation,
    }),
  );

  expect(payload).toMatchObject({
    schemaVersion: 1,
    source: "peated.admin.audit_operation",
    audit: {
      id: 9,
      intent: "audit_bottle",
      bottleId: 44,
      schemaVersion: 2,
      output: {
        summary: "Review the proposed catalog work.",
        findings: [],
      },
    },
    operation,
    liveReview,
  });
  expect(payload.audit).not.toHaveProperty("operations");
});
