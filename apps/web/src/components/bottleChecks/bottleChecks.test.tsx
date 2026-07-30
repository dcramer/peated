import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ActionResults, { runActionWithCanonicalRefresh } from "./actionResults";
import CheckResult from "./checkResult";
import { BottleCheckOrigin, BottleCheckSubject } from "./checkSummary";
import OperationCard, {
  type BottleOperation,
  type BottleOperationReview,
} from "./operationCard";

function operation(
  status: BottleOperation["status"],
  overrides: Partial<BottleOperation> = {},
): BottleOperation {
  return {
    id: 17,
    checkId: 9,
    proposal: {
      type: "update_entity",
      input: {
        entityId: 42,
        patch: { name: "Correct Brand" },
      },
      rationale: "The label and official producer site support this name.",
      evidenceRefs: [
        { kind: "entity", entityId: 42 },
        { kind: "web_result", url: "https://example.com/evidence" },
      ],
    },
    resolvedEvidenceRefs: [{ kind: "entity", entityId: 42 }],
    stateToken: {},
    preparationError: null,
    status,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    reviewerNote: null,
    result: null,
    error: null,
    preparedAt: "2026-07-30T00:00:00.000Z",
    executionStartedAt: null,
    executionCompletedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

const entityReview = {
  id: 17,
  type: "update_entity",
  status: "pending_review",
  proposal: operation("pending_review").proposal,
  preview: {
    before: {
      entityId: 42,
      name: "Wrong Brand",
      shortName: null,
      roles: ["brand"],
      website: null,
      location: { country: null, region: null },
      yearEstablished: null,
    },
    after: {
      entityId: 42,
      name: "Correct Brand",
      shortName: null,
      roles: ["brand"],
      website: null,
      location: { country: null, region: null },
      yearEstablished: null,
    },
    changedFields: ["name"],
    impact: {
      bottles: 8,
      brandGroups: 3,
      bottlerGroups: 0,
      distillerGroups: 0,
      series: 1,
      aliases: 2,
    },
    warnings: [{ code: "role_union", message: "Roles will be preserved." }],
  },
  stateToken: {},
} as BottleOperationReview;

describe("Bottle Check review components", () => {
  it("waits for canonical detail refresh before publishing action results", async () => {
    const events: string[] = [];

    const result = await runActionWithCanonicalRefresh({
      action: async () => {
        events.push("action");
        return [{ operationId: 17, status: "applied", error: null }] as const;
      },
      refresh: async () => {
        events.push("refresh");
      },
    });

    events.push("publish");

    expect(events).toEqual(["action", "refresh", "publish"]);
    expect(result[0]).toMatchObject({ status: "applied" });
  });

  it("renders reference source identity without an audit-origin label", () => {
    const check = {
      bottleId: null,
      intent: "resolve_reference",
      origin: null,
      sourceKind: "store_price",
      sourceId: "510",
    } as ComponentProps<typeof BottleCheckSubject>["check"];

    const subject = renderToStaticMarkup(<BottleCheckSubject check={check} />);
    const origin = renderToStaticMarkup(
      <BottleCheckOrigin
        check={check as ComponentProps<typeof BottleCheckOrigin>["check"]}
      />,
    );

    expect(subject).toContain("Store price #510");
    expect(subject).not.toContain("Deleted Bottle");
    expect(origin).toBe("");
  });

  it("renders a read-only resource preview with links, evidence, impact, and warnings", () => {
    const html = renderToStaticMarkup(
      <OperationCard
        operation={operation("pending_review")}
        review={entityReview}
        showDisposition={false}
      />,
    );

    expect(html).toContain("Update Entity");
    expect(html).toContain("Pending review");
    expect(html).toContain('href="/entities/42/edit"');
    expect(html).toContain("The label and official producer site");
    expect(html).toContain('href="https://example.com/evidence"');
    expect(html).toContain("Wrong Brand");
    expect(html).toContain("Correct Brand");
    expect(html).toContain("Roles will be preserved.");
    expect(html).not.toContain("Select");
  });

  it("renders blocked, applying, applied, stale, failed, and rejected dispositions", () => {
    const blocked = renderToStaticMarkup(
      <OperationCard
        operation={operation("blocked", {
          preparationError: {
            code: "target_not_inspected",
            message: "The target was not inspected.",
          },
        })}
        review={
          {
            id: 17,
            status: "blocked",
            proposal: operation("blocked").proposal,
            preparationError: {
              code: "target_not_inspected",
              message: "The target was not inspected.",
            },
          } as BottleOperationReview
        }
      />,
    );
    const applying = renderToStaticMarkup(
      <OperationCard operation={operation("applying")} review={entityReview} />,
    );
    const applied = renderToStaticMarkup(
      <OperationCard
        operation={operation("applied", {
          result: { entityId: 42, updated: true },
        })}
        review={null}
      />,
    );
    const stale = renderToStaticMarkup(
      <OperationCard
        operation={operation("stale", {
          error: "Relevant catalog state changed.",
        })}
        review={entityReview}
      />,
    );
    const failed = renderToStaticMarkup(
      <OperationCard
        onRetry={() => undefined}
        operation={operation("failed", { error: "Worker unavailable." })}
        review={entityReview}
      />,
    );
    const rejected = renderToStaticMarkup(
      <OperationCard
        operation={operation("rejected", {
          rejectionReason: "resolved_manually",
          reviewerNote: "Fixed in the Entity editor.",
        })}
        review={null}
      />,
    );

    expect(blocked).toContain("The target was not inspected.");
    expect(applying).toContain("Applying");
    expect(applying).toContain("Entity #42 is being updated.");
    expect(applied).toContain("Applied");
    expect(applied).toContain("Entity #42 was updated.");
    expect(applied).not.toContain("&quot;updated&quot;");
    expect(stale).toContain("Stale");
    expect(stale).toContain("Relevant catalog state changed.");
    expect(failed).toContain("Failed");
    expect(failed).toContain("Retry failed operation");
    expect(rejected).toContain("resolved manually");
    expect(rejected).toContain("Fixed in the Entity editor.");
  });

  it("hides retry while Bottle Check execution is disabled", () => {
    const html = renderToStaticMarkup(
      <OperationCard
        executionEnabled={false}
        onRetry={() => undefined}
        operation={operation("failed", { error: "Worker unavailable." })}
        review={entityReview}
      />,
    );

    expect(html).toContain("Worker unavailable.");
    expect(html).not.toContain("Retry failed operation");
  });

  it("shows clean and finding audit results without per-finding controls", () => {
    const baseCheck = {
      id: 9,
      intent: "audit_bottle",
      origin: "moderator",
      sourceKind: null,
      sourceId: null,
      bottleId: 44,
      subjectKey: "audit_bottle:bottle:44",
      backgroundEventKey: null,
      schemaVersion: 4,
      inputSnapshot: {},
      output: {
        summary: "The Bottle is supported.",
        findings: [],
      },
      artifacts: {},
      model: null,
      modelMetadata: null,
      error: null,
      storePriceMatchProposalId: null,
      storePriceMatchAttemptId: null,
      closedById: null,
      closeReason: null,
      closeNote: null,
      createdAt: "2026-07-30T00:00:00.000Z",
      completedAt: "2026-07-30T00:00:00.000Z",
      closedAt: null,
      operations: [],
    } as ComponentProps<typeof CheckResult>["check"];
    const clean = renderToStaticMarkup(<CheckResult check={baseCheck} />);
    const findings = renderToStaticMarkup(
      <CheckResult
        check={{
          ...baseCheck,
          output: {
            summary: "One relationship needs review.",
            findings: [
              {
                scope: "bottle_group",
                summary: "The Bottle may belong in another group.",
                evidenceRefs: [{ kind: "bottle", bottleId: 44 }],
              },
            ],
          },
        }}
      />,
    );

    expect(clean).toContain("No catalog changes");
    expect(clean).not.toContain("Approve");
    expect(findings).toContain("The Bottle may belong in another group.");
    expect(findings).toContain('href="/bottles/44"');
    expect(findings).toContain(
      "Findings are closed with the check; they do not have individual disposition controls.",
    );
  });

  it("reports mixed approve-selected outcomes independently", () => {
    const html = renderToStaticMarkup(
      <ActionResults
        results={[
          { operationId: 1, status: "applied", error: null },
          {
            operationId: 2,
            status: "failed",
            error: "Canonical update failed.",
          },
          {
            operationId: 3,
            status: null,
            error: "Operation was already reviewed.",
          },
        ]}
      />,
    );

    expect(html).toContain(
      "Each selected operation was processed independently.",
    );
    expect(html).toContain("Operation #1");
    expect(html).toContain("applied");
    expect(html).toContain("Canonical update failed.");
    expect(html).toContain("Not processed");
    expect(html).toContain("Operation was already reviewed.");
  });
});
