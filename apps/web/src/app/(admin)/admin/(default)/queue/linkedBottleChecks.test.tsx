import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LinkedBottleCheckDetails } from "./linkedBottleChecks";

type Details = Parameters<typeof LinkedBottleCheckDetails>[0]["details"];
type Operation = Details["check"]["operations"][number];

function checkDetails(
  overrides: Partial<Details["check"]> = {},
  reviewOperations: Details["reviewOperations"] = [],
): Details {
  return {
    check: {
      id: 41,
      intent: "resolve_reference",
      origin: null,
      sourceKind: "store_price",
      sourceId: "510",
      bottleId: null,
      subjectKey: "resolve_reference:store_price:510",
      backgroundEventKey: null,
      schemaVersion: 1,
      inputSnapshot: {},
      output: {
        status: "classified",
        decision: {
          rationale: "The listing decision is sound.",
        },
        findings: [],
      },
      artifacts: null,
      model: "test-model",
      modelMetadata: null,
      error: null,
      storePriceMatchProposalId: 12,
      storePriceMatchAttemptId: 13,
      closedById: null,
      closeReason: null,
      closeNote: null,
      createdAt: "2026-07-30T12:00:00.000Z",
      completedAt: "2026-07-30T12:01:00.000Z",
      closedAt: null,
      operations: [],
      ...overrides,
    },
    reviewOperations,
  } as Details;
}

function mergeOperation(status: Operation["status"]): Operation {
  return {
    id: 77,
    checkId: 41,
    proposal: {
      type: "merge_bottles",
      input: {
        sourceBottleId: 101,
        destinationBottleId: 202,
      },
      rationale: "These are exact duplicates.",
      evidenceRefs: [
        { kind: "bottle", bottleId: 101 },
        { kind: "bottle", bottleId: 202 },
      ],
    },
    resolvedEvidenceRefs: null,
    stateToken: null,
    preparationError: null,
    status,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    reviewerNote: null,
    result: status === "applied" ? { changed: true } : null,
    error: null,
    preparedAt: null,
    executionStartedAt: null,
    executionCompletedAt: null,
    createdAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
  };
}

describe("linked Incoming Listings Bottle checks", () => {
  it("renders a clean linked check without empty operation controls", () => {
    const html = renderToStaticMarkup(
      <LinkedBottleCheckDetails
        details={checkDetails({
          output: {
            status: "classified",
            decision: {
              rationale: "The listing matched without supplemental cleanup.",
            },
            findings: [],
          },
        })}
      />,
    );

    expect(html).toContain("Supplemental Bottle check");
    expect(html).toContain("The listing matched without supplemental cleanup.");
    expect(html).toContain(
      "No catalog changes or unresolved findings were proposed.",
    );
    expect(html).not.toContain(">Select<");
  });

  it("renders findings and the current live operation preview read-only", () => {
    const operation = mergeOperation("pending_review");
    const html = renderToStaticMarkup(
      <LinkedBottleCheckDetails
        details={checkDetails(
          {
            output: {
              status: "classified",
              decision: {
                rationale: "The match is correct, but duplicates remain.",
              },
              findings: [
                {
                  scope: "bottle",
                  summary: "The duplicate needs moderator review.",
                  evidenceRefs: [{ kind: "bottle", bottleId: 101 }],
                },
              ],
            },
            operations: [operation],
          },
          [
            {
              operationId: operation.id,
              review: {
                type: "merge_bottles",
                status: "pending_review",
                proposal: operation.proposal,
                stateToken: {},
                preview: {
                  source: {
                    bottleId: 101,
                    fullName: "Malformed Duplicate",
                  },
                  destination: {
                    bottleId: 202,
                    fullName: "Canonical Bottle",
                  },
                  consumers: {
                    storePrices: 2,
                  },
                  warnings: [],
                },
              },
            },
          ] as unknown as Details["reviewOperations"],
        )}
      />,
    );

    expect(html).toContain("The duplicate needs moderator review.");
    expect(html).toContain("Malformed Duplicate");
    expect(html).toContain("Canonical Bottle");
    expect(html).toContain("store Prices");
    expect(html).not.toContain(">Select<");
  });

  it("shows completed operations without disposition controls", () => {
    const operation = mergeOperation("applied");
    const html = renderToStaticMarkup(
      <LinkedBottleCheckDetails
        details={checkDetails({
          output: {
            status: "classified",
            decision: { rationale: "All cleanup is complete." },
            findings: [],
          },
          operations: [operation],
        })}
      />,
    );

    expect(html).toContain("Complete");
    expect(html).toContain("Applied");
    expect(html).not.toContain(">Select<");
    expect(html).not.toContain("Retry failed operation");
  });
});
