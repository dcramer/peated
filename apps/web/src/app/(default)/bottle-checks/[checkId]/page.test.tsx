import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

type Details = Outputs["bottleChecks"]["details"];
type Operation = Details["check"]["operations"][number];

const testState = vi.hoisted(() => ({
  details: null as unknown,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ checkId: "9" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useSuspenseQuery: () => ({ data: testState.details }),
}));

vi.mock("@peated/web/hooks/useBottleCheckCapabilities", () => ({
  default: () => ({
    bottleAudits: true,
    bottleCheckExecution: false,
    bottleChecks: true,
  }),
}));

vi.mock("@peated/web/lib/orpc/context", () => ({
  useORPC: () => ({
    bottleChecks: {
      approveSelected: { mutationOptions: () => ({}) },
      close: { mutationOptions: () => ({}) },
      details: {
        queryOptions: () => ({ queryKey: ["bottle-checks", "details", 9] }),
      },
      history: {
        queryOptions: () => ({ queryKey: ["bottle-checks", "history", 44] }),
      },
      list: {
        queryOptions: () => ({ queryKey: ["bottle-checks", "list"] }),
      },
      rejectSelected: { mutationOptions: () => ({}) },
      retry: { mutationOptions: () => ({}) },
    },
  }),
}));

function operation(
  status: Operation["status"],
  overrides: Partial<Operation> = {},
): Operation {
  return {
    id: status === "failed" ? 18 : 17,
    checkId: 9,
    proposal: {
      type: "update_entity",
      input: {
        entityId: 42,
        patch: { name: "Correct Brand" },
      },
      rationale: "The inspected evidence supports this change.",
      evidenceRefs: [{ kind: "entity", entityId: 42 }],
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
    error: status === "failed" ? "Worker unavailable." : null,
    preparedAt: "2026-07-30T00:00:00.000Z",
    executionStartedAt: null,
    executionCompletedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function details(operations: Operation[]): Details {
  return {
    check: {
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
        summary: "Review the proposed catalog work.",
        findings: [
          {
            scope: "bottle",
            summary: "The remaining issue needs moderator review.",
            evidenceRefs: [{ kind: "bottle", bottleId: 44 }],
          },
        ],
      },
      artifacts: {},
      model: "test-model",
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
      operations,
    },
    reviewOperations: [],
  };
}

describe("Bottle Check detail execution rollout", () => {
  beforeEach(() => {
    testState.details = details([]);
  });

  test("omits execution controls while keeping pending rejection available", () => {
    testState.details = details([
      operation("pending_review"),
      operation("failed"),
    ]);

    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain(
      "Applying catalog changes is disabled during rollout",
    );
    expect(html).not.toContain("Approve selected");
    expect(html).not.toContain("Retry failed operation");
    expect(html).toContain("Reject selected");
  });

  test("keeps close available for unresolved failed work", () => {
    testState.details = details([operation("failed")]);

    const html = renderToStaticMarkup(<Page />);

    expect(html).not.toContain("Approve selected");
    expect(html).not.toContain("Retry failed operation");
    expect(html).toContain("Close check");
  });
});
