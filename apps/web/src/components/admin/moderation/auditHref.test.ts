import { describe, expect, test } from "vitest";
import { moderationHrefForAudit } from "./auditHref";

type Audit = Extract<
  Parameters<typeof moderationHrefForAudit>[0],
  { schemaSupported: true }
>;
type AuditOperation = Audit["operations"][number];

function audit(overrides: Partial<Audit> = {}): Audit {
  return {
    id: 91,
    schemaSupported: true,
    closedAt: null,
    operations: [],
    output: { findings: [] },
    ...overrides,
  };
}

describe("legacy audit routing", () => {
  test("opens each independent decision in the Moderation Inbox", () => {
    const operation: AuditOperation = {
      id: 701,
      status: "pending_review",
    };

    expect(moderationHrefForAudit(audit({ operations: [operation] }))).toBe(
      "/admin/moderation/inbox/operation/701",
    );
  });

  test("routes operational and terminal checks to their owning views", () => {
    const failed: AuditOperation = {
      id: 702,
      status: "failed",
    };

    expect(moderationHrefForAudit(audit({ operations: [failed] }))).toBe(
      "/admin/moderation/automation",
    );
    expect(
      moderationHrefForAudit(audit({ closedAt: "2026-08-13T00:00:00.000Z" })),
    ).toBe("/admin/moderation/history?category=catalog");
  });
});
