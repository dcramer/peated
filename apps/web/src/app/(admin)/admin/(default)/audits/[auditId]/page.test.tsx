import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

type Details = Outputs["audits"]["details"];
type Operation = Details["audit"]["operations"][number];
type ReviewOperation = NonNullable<
  Details["reviewOperations"][number]["review"]
>;

const testState = vi.hoisted(() => ({
  details: null as unknown,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ auditId: "9" }),
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

vi.mock("@peated/web/lib/orpc/context", () => ({
  useORPC: () => ({
    audits: {
      approveSelected: { mutationOptions: () => ({}) },
      close: { mutationOptions: () => ({}) },
      details: {
        queryOptions: () => ({ queryKey: ["audits", "details", 9] }),
      },
      list: {
        queryOptions: () => ({ queryKey: ["audits", "list"] }),
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
    preparationError: null,
    status,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    reviewerNote: null,
    result: null,
    error: status === "failed" ? "Worker unavailable." : null,
    executionStartedAt: null,
    executionCompletedAt: null,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function reviewForOperation(operation: Operation): ReviewOperation {
  if (operation.proposal.type !== "update_entity") {
    throw new Error("Expected an update_entity operation.");
  }
  if (operation.status === "blocked") {
    return {
      id: operation.id,
      status: "blocked",
      proposal: operation.proposal,
      preparationError: {
        code: "invalid_current_state",
        message: "The operation is blocked.",
      },
    };
  }
  if (operation.status === "applied" || operation.status === "rejected") {
    throw new Error("Terminal operations do not have a live review.");
  }
  return {
    id: operation.id,
    type: "update_entity",
    status: operation.status,
    proposal: operation.proposal,
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
        bottles: 1,
        brandGroups: 1,
        bottlerGroups: 0,
        distillerGroups: 0,
        series: 0,
        aliases: 0,
      },
      warnings: [],
    },
  };
}

function details(
  operations: Operation[],
  checkOverrides: Partial<
    Extract<Details["audit"], { schemaSupported: true }>
  > = {},
): Details {
  return {
    audit: {
      id: 9,
      intent: "audit_bottle",
      origin: "moderator",
      sourceKind: null,
      sourceId: null,
      bottleId: 44,
      schemaSupported: true,
      schemaVersion: 1,
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
      model: "test-model",
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
      ...checkOverrides,
    } as Extract<Details["audit"], { schemaSupported: true }>,
    reviewOperations: operations.map((operation) => ({
      operationId: operation.id,
      review:
        operation.status === "applied" || operation.status === "rejected"
          ? null
          : reviewForOperation(operation),
      approvalReady: operation.status === "pending_review",
    })),
  };
}

describe("Audit detail", () => {
  beforeEach(() => {
    testState.details = details([]);
  });

  test("renders direct independent operation controls", () => {
    testState.details = details([
      operation("pending_review"),
      operation("failed"),
    ]);

    const html = renderToStaticMarkup(<Page />);

    expect(html).not.toContain("disabled during rollout");
    expect(html).not.toContain("Approve selected");
    expect(html).not.toContain("Reject selected");
    expect(html).not.toContain("Selected operations");
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Apply");
    expect(html).toContain("Reject");
    expect(html).toContain("Retry failed operation");
    expect(html).toContain("Copy operation payload");
  });

  test("keeps rejection and close available for unresolved failed work", () => {
    testState.details = details([operation("failed")]);

    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain("Retry failed operation");
    expect(html).toContain("Reject");
    expect(html).not.toContain("Select");
    expect(html).toContain("Close without further catalog changes");
    expect(html).toContain("Close audit");
  });

  test("returns store-price references to Incoming Listings", () => {
    testState.details = details([], {
      intent: "resolve_reference",
      origin: null,
      sourceKind: "store_price",
      sourceId: "510",
      bottleId: null,
      output: {
        status: "classified",
        decision: {
          action: "match",
          rationale: "The listing matched an existing Bottle.",
          candidateBottleIds: [44],
          identityScope: "product",
          observation: null,
          matchedBottleId: 44,
          proposedBottle: null,
        },
        findings: [],
      },
    });

    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain('href="/admin/queue"');
    expect(html).toContain("Incoming Listings");
    expect(html).toContain("Reference result");
    expect(html).not.toContain('href="/admin/audits"');
  });
});
