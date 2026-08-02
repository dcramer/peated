import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

type Details = Outputs["bottleChecks"]["details"];
type Operation = Details["check"]["operations"][number];
type ReviewOperation = NonNullable<
  Details["reviewOperations"][number]["review"]
>;

const testState = vi.hoisted(() => ({
  details: null as unknown,
  user: { admin: true, mod: false },
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

vi.mock("@peated/web/hooks/useAuth", () => ({
  default: () => ({ user: testState.user }),
}));

vi.mock("@peated/web/lib/orpc/context", () => ({
  useORPC: () => ({
    bottleChecks: {
      approveSelected: { mutationOptions: () => ({}) },
      close: { mutationOptions: () => ({}) },
      details: {
        queryOptions: () => ({ queryKey: ["bottle-checks", "details", 9] }),
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
    Extract<Details["check"], { schemaSupported: true }>
  > = {},
): Details {
  return {
    check: {
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
    } as Extract<Details["check"], { schemaSupported: true }>,
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

describe("Bottle Check detail", () => {
  beforeEach(() => {
    testState.details = details([]);
    testState.user = { admin: true, mod: false };
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
  });

  test("keeps rejection and close available for unresolved failed work", () => {
    testState.details = details([operation("failed")]);

    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain("Retry failed operation");
    expect(html).toContain("Reject");
    expect(html).not.toContain("Select");
    expect(html).toContain("Close without further catalog changes");
    expect(html).toContain("Close check");
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
    expect(html).not.toContain('href="/bottle-checks"');
  });

  test("returns moderator-only store-price reviews to Bottle Checks", () => {
    testState.user = { admin: false, mod: true };
    testState.details = details([], {
      intent: "resolve_reference",
      origin: null,
      sourceKind: "store_price",
      sourceId: "510",
      bottleId: null,
      output: {
        status: "ignored",
        reason: "The listing needs moderator review.",
        findings: [],
      },
    });

    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain('href="/bottle-checks"');
    expect(html).toContain("Bottle Checks");
    expect(html).not.toContain('href="/admin/queue"');
  });
});
