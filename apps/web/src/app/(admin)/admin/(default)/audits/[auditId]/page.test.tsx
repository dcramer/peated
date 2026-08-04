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
  bottle: { id: 44, fullName: "Lagavulin 16-year-old" },
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
  useSuspenseQuery: (options: { queryKey: string[] }) => ({
    data:
      options.queryKey[0] === "bottles" ? testState.bottle : testState.details,
  }),
}));

vi.mock("@peated/web/components/search/bottleResult", () => ({
  default: ({
    result,
  }: {
    result: { ref: { id: number; fullName: string } };
  }) => <a href={`/bottles/${result.ref.id}`}>{result.ref.fullName}</a>,
}));

vi.mock("@peated/web/lib/orpc/context", () => ({
  useORPC: () => ({
    bottles: {
      details: {
        queryOptions: () => ({ queryKey: ["bottles", "details", "44"] }),
      },
    },
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
      modelMetadata: {
        agentDurationMs: 2_400,
        usage: {
          requests: 2,
          inputTokens: 10_000,
          outputTokens: 800,
          totalTokens: 10_800,
        },
        toolCalls: { count: 3, names: ["search_bottles"] },
        cost: {
          scope: "agent_loop_only",
          costCoverage: "priced_model_tokens",
          estimatedAgentLoopCostUsd: 0.044,
          pricingModel: "gpt-5.6-terra",
          pricingEffectiveDate: "2026-08-01",
          pricingSource: "https://developers.openai.com/api/docs/pricing",
          pricingBasis: "standard_short_context",
        },
      },
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

  test("puts the audited Bottle first and shows run metadata", () => {
    const html = renderToStaticMarkup(<Page />);

    expect(html.indexOf("Lagavulin 16-year-old")).toBeLessThan(
      html.indexOf("Bottle audit"),
    );
    expect(html).toContain('aria-label="Audited Bottle"');
    expect(html).toContain("10,800");
    expect(html).toContain("$0.0440");
    expect(html).toContain("2.4 sec");
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
