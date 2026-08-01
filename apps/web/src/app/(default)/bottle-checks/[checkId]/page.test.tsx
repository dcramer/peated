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

function entityStateToken() {
  return {
    entityId: 42,
    fields: { name: "Wrong Brand" },
    referencedCountry: null,
    referencedRegion: null,
  };
}

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
    stateToken: entityStateToken(),
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
    stateToken: entityStateToken(),
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
      subjectKey: "audit_bottle:bottle:44",
      backgroundEventKey: null,
      schemaSupported: true,
      schemaVersion: 1,
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
      ...checkOverrides,
    },
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

  test("keeps rejection and close available for unresolved failed work", () => {
    testState.details = details([operation("failed")]);

    const html = renderToStaticMarkup(<Page />);

    expect(html).not.toContain("Approve selected");
    expect(html).not.toContain("Retry failed operation");
    expect(html).toContain("Reject selected");
    expect(html).toContain("Select");
    expect(html).toContain("Close check");
  });

  test("returns store-price references to Incoming Listings", () => {
    testState.details = details([], {
      intent: "resolve_reference",
      origin: null,
      sourceKind: "store_price",
      sourceId: "510",
      bottleId: null,
      subjectKey: "resolve_reference:store_price:510",
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
});
