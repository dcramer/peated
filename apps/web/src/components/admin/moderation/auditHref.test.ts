import type { Outputs } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";
import { moderationHrefForAudit } from "./auditHref";

type Audit = Outputs["audits"]["details"]["audit"];

function audit(overrides: Partial<Audit> = {}): Audit {
  return {
    id: 91,
    schemaSupported: true,
    schemaVersion: 5,
    intent: "audit_bottle",
    origin: "moderator",
    sourceKind: null,
    sourceId: null,
    bottleId: 1,
    model: null,
    modelMetadata: null,
    error: null,
    storePriceMatchProposalId: null,
    storePriceMatchAttemptId: null,
    closedById: null,
    closeReason: null,
    closeNote: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    completedAt: "2026-08-12T00:01:00.000Z",
    closedAt: null,
    operations: [],
    output: { findings: [], summary: "No findings." },
    ...overrides,
  } as Audit;
}

describe("legacy audit routing", () => {
  test("opens each independent decision in the Moderation Inbox", () => {
    const operation = {
      id: 701,
      status: "pending_review",
    } as Audit extends { operations: Array<infer Operation> }
      ? Operation
      : never;

    expect(moderationHrefForAudit(audit({ operations: [operation] }))).toBe(
      "/admin/moderation/inbox/operation/701",
    );
  });

  test("routes operational and terminal checks to their owning views", () => {
    const failed = {
      id: 702,
      status: "failed",
    } as Audit extends { operations: Array<infer Operation> }
      ? Operation
      : never;

    expect(moderationHrefForAudit(audit({ operations: [failed] }))).toBe(
      "/admin/moderation/automation",
    );
    expect(
      moderationHrefForAudit(audit({ closedAt: "2026-08-13T00:00:00.000Z" })),
    ).toBe("/admin/moderation/history?category=catalog");
  });
});
