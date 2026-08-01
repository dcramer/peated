import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { BottleCheckRow } from "./page";

test("Bottle Checks renders one inbox row per actionable check", () => {
  const check = {
    id: 51,
    intent: "audit_bottle",
    origin: "post_user_creation",
    sourceKind: null,
    sourceId: null,
    bottleId: 45146,
    subjectKey: "audit_bottle:bottle:45146",
    backgroundEventKey: "bottle_created:45146",
    schemaSupported: true,
    schemaVersion: 1,
    inputSnapshot: {},
    output: {
      summary: "One catalog correction needs review.",
      findings: [
        {
          scope: "bottle_group",
          summary: "The group relationship needs review.",
          evidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
        },
      ],
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
    operations: [
      {
        id: 71,
        checkId: 51,
        proposal: {
          type: "update_bottle",
          input: {
            bottleId: 45146,
            patch: { exact: { edition: "Warehouse 1" } },
          },
          rationale: "The label names Warehouse 1.",
          evidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
        },
        resolvedEvidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
        stateToken: {},
        preparationError: null,
        status: "pending_review",
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
      },
    ],
  } as ComponentProps<typeof BottleCheckRow>["check"];

  const html = renderToStaticMarkup(
    <table>
      <tbody>
        <BottleCheckRow check={check} />
      </tbody>
    </table>,
  );

  expect(html.match(/<tr/g)).toHaveLength(1);
  expect(html).toContain("Bottle #45146");
  expect(html).toContain("1 operation");
  expect(html).toContain("1 finding");
  expect(html).toContain('href="/bottle-checks/51"');
});
