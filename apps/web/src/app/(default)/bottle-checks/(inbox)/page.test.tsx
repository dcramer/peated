import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BottleCheckEmptyState, BottleCheckRow } from "./page";

test("Bottle Checks renders one inbox row per actionable check", () => {
  const check = {
    id: 51,
    intent: "audit_bottle",
    origin: "post_user_creation",
    sourceKind: null,
    sourceId: null,
    bottleId: 45146,
    schemaSupported: true,
    schemaVersion: 1,
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
    model: null,
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
        preparationError: null,
        status: "pending_review",
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        reviewerNote: null,
        result: null,
        error: null,
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

describe("Bottle Checks empty states", () => {
  test("offers to clear an empty filter", () => {
    const html = renderToStaticMarkup(
      <BottleCheckEmptyState clearHref="/bottle-checks" filtered />,
    );

    expect(html).toContain("No Bottle checks match this filter.");
    expect(html).toContain('href="/bottle-checks"');
    expect(html).toContain("Clear filter");
  });

  test("keeps the unfiltered inbox message concise", () => {
    const html = renderToStaticMarkup(
      <BottleCheckEmptyState clearHref="/bottle-checks" filtered={false} />,
    );

    expect(html).toContain("No Bottle checks need attention.");
    expect(html).not.toContain("Clear filter");
  });
});
