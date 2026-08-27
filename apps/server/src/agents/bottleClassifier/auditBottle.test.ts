import {
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
} from "@peated/bottle-classifier/contract";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleChecks,
  bottleOperations,
  bottles,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  runModeratorBottleAudit as runModeratorBottleAuditWithService,
  runPostUserCreationBottleAudit as runPostUserCreationBottleAuditWithService,
} from "./auditBottle";
import { classifyBottleReference } from "./index";
import type * as classifierService from "./service";

const auditBottleWithServerAdapters =
  vi.fn<typeof classifierService.runBottleAudit>();

function runModeratorBottleAudit(
  input: Parameters<typeof runModeratorBottleAuditWithService>[0],
) {
  return runModeratorBottleAuditWithService(
    input,
    auditBottleWithServerAdapters,
  );
}

function runPostUserCreationBottleAudit(
  input: Parameters<typeof runPostUserCreationBottleAuditWithService>[0],
) {
  return runPostUserCreationBottleAuditWithService(
    input,
    auditBottleWithServerAdapters,
  );
}

async function auditResult({
  bottleId,
  blockedEntityId,
  includeFinding = true,
}: {
  bottleId: number;
  blockedEntityId?: number;
  includeFinding?: boolean;
}) {
  const { getBottleClassifierContext } = await import("./contextAdapters");
  const bottleContext = await getBottleClassifierContext(bottleId);
  if (!bottleContext) {
    throw new Error(`Bottle ${bottleId} context was not found.`);
  }
  const { imageSources: _imageSources, ...contextFields } = bottleContext;

  return createAuditBottleResult({
    summary: "The Bottle has one supported correction and one review finding.",
    proposedOperations: [
      {
        type: "update_bottle",
        input: {
          bottleId,
          patch: { edition: "Audited Edition" },
        },
        rationale: "The inspected Bottle has a missing edition.",
        evidenceRefs: [{ kind: "bottle", bottleId }],
      },
      ...(blockedEntityId === undefined
        ? []
        : [
            {
              type: "update_entity" as const,
              input: {
                entityId: blockedEntityId,
                patch: { shortName: "Uninspected" },
              },
              rationale: "This Entity was not inspected.",
              evidenceRefs: [{ kind: "bottle" as const, bottleId }],
            },
          ]),
    ],
    findings: includeFinding
      ? [
          {
            scope: "bottle_group",
            summary: "The group relationship needs moderator judgment.",
            evidenceRefs: [{ kind: "bottle", bottleId }],
          },
        ]
      : [],
    artifacts: buildBottleClassificationArtifacts({
      bottleContexts: [{ ...contextFields, publicImages: [] }],
    }),
  });
}

describe("server-owned Bottle audit workflows", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("persists a moderator audit with fixed intent and origin while retaining blocked siblings", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    const uninspectedEntity = await fixtures.Entity();
    auditBottleWithServerAdapters.mockResolvedValue({
      result: await auditResult({
        bottleId: bottle.id,
        blockedEntityId: uninspectedEntity.id,
      }),
      modelMetadata: {
        agentDurationMs: 840,
        usage: {
          requests: 2,
          inputTokens: 1200,
          outputTokens: 180,
          totalTokens: 1380,
        },
        toolCalls: {
          count: 1,
          names: ["get_bottle_context"],
        },
      },
    });

    const created = await runModeratorBottleAudit({
      bottleId: bottle.id,
      note: "Check the label identity.",
    });

    expect(created.status).toBe("needs_review");
    if (created.status !== "needs_review") {
      throw new Error("Expected an actionable Bottle audit.");
    }
    expect(auditBottleWithServerAdapters).toHaveBeenCalledWith({
      bottleId: bottle.id,
      origin: "moderator",
      note: "Check the label identity.",
    });
    expect(created.check).toMatchObject({
      intent: "audit_bottle",
      origin: "moderator",
      bottleId: bottle.id,
      backgroundEventKey: null,
      model: config.BOTTLE_CLASSIFIER_MODEL,
      modelMetadata: {
        agentDurationMs: 840,
        usage: {
          requests: 2,
          inputTokens: 1200,
          outputTokens: 180,
          totalTokens: 1380,
        },
        toolCalls: {
          count: 1,
          names: ["get_bottle_context"],
        },
      },
      inputSnapshot: {
        bottleId: bottle.id,
        origin: "moderator",
        note: "Check the label identity.",
      },
      output: {
        summary:
          "The Bottle has one supported correction and one review finding.",
        findings: [
          {
            scope: "bottle_group",
            summary: "The group relationship needs moderator judgment.",
          },
        ],
      },
    });
    expect(
      created.check.operations
        .map(({ status }) => status)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(["blocked", "pending_review"]);
    expect(
      created.check.operations.find(({ status }) => status === "blocked"),
    ).toMatchObject({
      preparationError: { code: "target_not_inspected" },
      stateToken: null,
    });
    expect(
      created.check.operations.find(
        ({ status }) => status === "pending_review",
      ),
    ).toMatchObject({
      stateToken: expect.any(Object),
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
        columns: { edition: true },
      }),
    ).toEqual({ edition: null });
  });

  test("rejects caller-owned origin and reuses current moderator work", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    auditBottleWithServerAdapters.mockResolvedValue({
      result: await auditResult({
        bottleId: bottle.id,
        includeFinding: false,
      }),
      modelMetadata: null,
    });

    await expect(
      // SAFETY: This test sends an invalid audit origin to the runtime validator.
      runModeratorBottleAudit({
        bottleId: bottle.id,
        origin: "post_user_creation",
      } as never),
    ).rejects.toThrow();

    const first = await runModeratorBottleAudit({ bottleId: bottle.id });
    const second = await runModeratorBottleAudit({ bottleId: bottle.id });

    expect(first.status).toBe("needs_review");
    expect(second.status).toBe("needs_review");
    if (first.status !== "needs_review" || second.status !== "needs_review") {
      throw new Error("Expected actionable Bottle audits.");
    }
    expect(second.check.id).toBe(first.check.id);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(1);
    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toHaveLength(1);
  });

  test("returns a transient clean result without persistence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    auditBottleWithServerAdapters.mockResolvedValue({
      result: createAuditBottleResult({
        summary: "The Bottle is clean.",
        proposedOperations: [],
        findings: [],
        artifacts: buildBottleClassificationArtifacts({}),
      }),
      modelMetadata: null,
    });

    await expect(
      runModeratorBottleAudit({ bottleId: bottle.id }),
    ).resolves.toEqual({ status: "clean", summary: "The Bottle is clean." });
    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toEqual([]);
  });

  test("a clean rerun removes prior terminal moderator work", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    auditBottleWithServerAdapters.mockResolvedValueOnce({
      result: await auditResult({
        bottleId: bottle.id,
        includeFinding: false,
      }),
      modelMetadata: null,
    });

    const first = await runModeratorBottleAudit({ bottleId: bottle.id });
    if (first.status !== "needs_review") {
      throw new Error("Expected an actionable Bottle audit.");
    }
    await db
      .update(bottleOperations)
      .set({ status: "applied" })
      .where(eq(bottleOperations.checkId, first.check.id));
    auditBottleWithServerAdapters.mockResolvedValueOnce({
      result: createAuditBottleResult({
        summary: "The Bottle is now clean.",
        proposedOperations: [],
        findings: [],
        artifacts: buildBottleClassificationArtifacts({}),
      }),
      modelMetadata: null,
    });

    await expect(
      runModeratorBottleAudit({ bottleId: bottle.id }),
    ).resolves.toEqual({
      status: "clean",
      summary: "The Bottle is now clean.",
    });
    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toEqual([]);
  });

  test("replaces prior terminal moderator work with the new actionable check", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    auditBottleWithServerAdapters.mockResolvedValue({
      result: await auditResult({
        bottleId: bottle.id,
        includeFinding: false,
      }),
      modelMetadata: null,
    });

    const first = await runModeratorBottleAudit({ bottleId: bottle.id });
    if (first.status !== "needs_review") {
      throw new Error("Expected an actionable Bottle audit.");
    }
    await db
      .update(bottleOperations)
      .set({ status: "rejected" })
      .where(eq(bottleOperations.checkId, first.check.id));
    const second = await runModeratorBottleAudit({ bottleId: bottle.id });
    if (second.status !== "needs_review") {
      throw new Error("Expected an actionable Bottle audit.");
    }
    expect(second.check.id).not.toBe(first.check.id);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(2);
    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toEqual([expect.objectContaining({ id: second.check.id })]);
  });

  test("does not delete closed failed moderator work when replacing a check", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    auditBottleWithServerAdapters.mockResolvedValue({
      result: await auditResult({ bottleId: bottle.id }),
      modelMetadata: null,
    });

    const first = await runModeratorBottleAudit({ bottleId: bottle.id });
    if (first.status !== "needs_review") {
      throw new Error("Expected an actionable Bottle audit.");
    }
    await db
      .update(bottleOperations)
      .set({ status: "failed" })
      .where(eq(bottleOperations.checkId, first.check.id));
    await db
      .update(bottleChecks)
      .set({ closedAt: new Date() })
      .where(eq(bottleChecks.id, first.check.id));

    const second = await runModeratorBottleAudit({ bottleId: bottle.id });
    if (second.status !== "needs_review") {
      throw new Error("Expected an actionable Bottle audit.");
    }
    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toHaveLength(2);
  });

  test("deduplicates a post-user-creation audit by its caller-owned event key", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    const result = await auditResult({ bottleId: bottle.id });
    auditBottleWithServerAdapters.mockResolvedValue({
      result,
      modelMetadata: null,
    });
    const input = {
      bottleId: bottle.id,
      backgroundEventKey: `bottle_created:${bottle.id}`,
    };

    const first = await runPostUserCreationBottleAudit(input);
    const second = await runPostUserCreationBottleAudit(input);

    expect(first).toMatchObject({
      created: true,
      check: {
        intent: "audit_bottle",
        origin: "post_user_creation",
        backgroundEventKey: input.backgroundEventKey,
      },
    });
    expect(second).toMatchObject({
      created: false,
      check: { id: first?.check.id },
    });
    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(1);
    expect(
      await db
        .select({ id: bottleChecks.id })
        .from(bottleChecks)
        .where(eq(bottleChecks.backgroundEventKey, input.backgroundEventKey)),
    ).toHaveLength(1);
  });

  test("discards a post-user-creation audit after its Bottle is deleted", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const deferred =
      Promise.withResolvers<
        Awaited<ReturnType<typeof auditBottleWithServerAdapters>>
      >();
    auditBottleWithServerAdapters.mockImplementation(
      async () => await deferred.promise,
    );
    const input = {
      bottleId: bottle.id,
      backgroundEventKey: `deleted_bottle_created:${bottle.id}`,
    };

    const work = runPostUserCreationBottleAudit(input);
    await vi.waitFor(() =>
      expect(auditBottleWithServerAdapters).toHaveBeenCalledOnce(),
    );
    await db.transaction(async (tx) => {
      await tx
        .delete(bottleAliases)
        .where(eq(bottleAliases.bottleId, bottle.id));
      await tx.delete(bottles).where(eq(bottles.id, bottle.id));
    });
    deferred.resolve({
      result: createAuditBottleResult({
        summary: "The deleted Bottle has no remaining verification work.",
        proposedOperations: [],
        findings: [],
        artifacts: buildBottleClassificationArtifacts({}),
      }),
      modelMetadata: null,
    });

    await expect(work).resolves.toBeNull();
    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.backgroundEventKey, input.backgroundEventKey),
      }),
    ).toEqual([]);
  });

  test("keeps concurrent post-user-creation retries race-safe at persistence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: null });
    const result = await auditResult({ bottleId: bottle.id });
    let auditCalls = 0;
    let releaseAudits = () => {};
    const auditBarrier = new Promise<void>((resolve) => {
      releaseAudits = resolve;
    });
    auditBottleWithServerAdapters.mockImplementation(async () => {
      auditCalls += 1;
      if (auditCalls === 2) {
        releaseAudits();
      }
      await auditBarrier;
      return { result, modelMetadata: null };
    });
    const input = {
      bottleId: bottle.id,
      backgroundEventKey: `concurrent_bottle_created:${bottle.id}`,
    };

    const results = await Promise.all([
      runPostUserCreationBottleAudit(input),
      runPostUserCreationBottleAudit(input),
    ]);

    expect(
      results
        .map((entry) => entry?.created)
        .sort((left, right) => String(left).localeCompare(String(right))),
    ).toEqual([false, true]);
    expect(results[0]?.check.id).toBe(results[1]?.check.id);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select({ id: bottleChecks.id })
        .from(bottleChecks)
        .where(eq(bottleChecks.backgroundEventKey, input.backgroundEventKey)),
    ).toHaveLength(1);
  });

  test("keeps the existing reference-classification entrypoint exported", () => {
    expect(classifyBottleReference).toBeTypeOf("function");
  });
});
