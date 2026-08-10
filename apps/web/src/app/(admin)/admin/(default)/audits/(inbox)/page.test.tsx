import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  BottleCheckEmptyState,
  BottleCheckRow,
  getBottleCheckSourceLabel,
} from "./page";

test.each([
  ["resolve_reference", null, "photo_identification", "Bottle photo scan"],
  ["resolve_reference", null, "store_price", "Incoming listing audit"],
  ["audit_bottle", "moderator", null, "Moderator audit"],
  ["audit_bottle", "post_user_creation", null, "Post-create audit"],
] as const)(
  "labels %s work from %s as %s",
  (intent, origin, sourceKind, expected) => {
    expect(getBottleCheckSourceLabel({ intent, origin, sourceKind })).toBe(
      expected,
    );
  },
);

test("Audits renders one inbox row per actionable check", () => {
  const check = {
    id: 51,
    intent: "audit_bottle",
    origin: "post_user_creation",
    sourceKind: null,
    sourceId: null,
    bottleId: 45146,
    schemaSupported: true,
    schemaVersion: 2,
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
        excludedFields: [],
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

  const html = renderToStaticMarkup(<BottleCheckRow check={check} />);

  expect(html.match(/<article/g)).toHaveLength(1);
  expect(html).toContain("Bottle #45146");
  expect(html).toContain("1 operation");
  expect(html).toContain("1 finding");
  expect(html).toContain('href="/admin/audits/51"');
  expect(
    renderToStaticMarkup(<BottleCheckRow check={check} source="new_bottle" />),
  ).toContain('href="/admin/audits/51?source=new_bottle"');
});

describe("Audits empty states", () => {
  test("offers to clear an empty filter", () => {
    const html = renderToStaticMarkup(
      <BottleCheckEmptyState clearHref="/admin/audits" filtered />,
    );

    expect(html).toContain("No audits match this filter.");
    expect(html).toContain('href="/admin/audits"');
    expect(html).toContain("Clear filter");
  });

  test("keeps the unfiltered inbox message concise", () => {
    const html = renderToStaticMarkup(
      <BottleCheckEmptyState clearHref="/admin/audits" filtered={false} />,
    );

    expect(html).toContain("No audits need attention.");
    expect(html).not.toContain("Clear filter");
  });
});
