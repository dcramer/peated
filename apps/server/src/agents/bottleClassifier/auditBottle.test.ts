import {
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
} from "@peated/bottle-classifier/contract";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleChecks, bottles } from "@peated/server/db/schema";
import { getBottleCheckHistory } from "@peated/server/lib/bottleChecks";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  BottleAuditUnavailableError,
  runModeratorBottleAudit,
  runPostUserCreationBottleAudit,
} from "./auditBottle";
import { classifyBottleReference } from "./index";
import { runBottleAudit as auditBottleWithServerAdapters } from "./service";

vi.mock("./service", () => {
  return {
    runBottleAudit: vi.fn(),
    classifyBottleReference: vi.fn(),
    identifyExistingBottleReference: vi.fn(),
  };
});

async function auditResult({
  bottleId,
  blockedEntityId,
}: {
  bottleId: number;
  blockedEntityId?: number;
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
          patch: { exact: { edition: "Audited Edition" } },
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
    findings: [
      {
        scope: "bottle_group",
        summary: "The group relationship needs moderator judgment.",
        evidenceRefs: [{ kind: "bottle", bottleId }],
      },
    ],
    artifacts: buildBottleClassificationArtifacts({
      bottleContexts: [{ ...contextFields, publicImages: [] }],
    }),
  });
}

describe("server-owned Bottle audit workflows", () => {
  afterEach(() => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = false;
    vi.resetAllMocks();
  });

  test("persists a moderator audit with fixed intent and origin while retaining blocked siblings", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle({ edition: null });
    const uninspectedEntity = await fixtures.Entity();
    vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
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

    expect(created.created).toBe(true);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledWith(
      {
        bottleId: bottle.id,
        origin: "moderator",
        note: "Check the label identity.",
      },
      {
        availableOperations: [
          "update_bottle",
          "merge_bottles",
          "update_entity",
          "merge_entities",
        ],
      },
    );
    expect(created.check).toMatchObject({
      intent: "audit_bottle",
      origin: "moderator",
      bottleId: bottle.id,
      backgroundEventKey: null,
      model: config.OPENAI_MODEL,
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
      resolvedEvidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
        columns: { edition: true },
      }),
    ).toEqual({ edition: null });
  });

  test("rejects caller-owned origin and preserves moderator reruns as separate checks", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle({ edition: null });
    vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
      result: await auditResult({ bottleId: bottle.id }),
      modelMetadata: null,
    });

    await expect(
      runModeratorBottleAudit({
        bottleId: bottle.id,
        origin: "post_user_creation",
      } as never),
    ).rejects.toThrow();

    const first = await runModeratorBottleAudit({ bottleId: bottle.id });
    const second = await runModeratorBottleAudit({ bottleId: bottle.id });

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(second.check.id).not.toBe(first.check.id);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(2);
    expect(
      await getBottleCheckHistory({
        intent: "audit_bottle",
        bottleId: bottle.id,
      }),
    ).toHaveLength(2);
  });

  test("deduplicates a post-user-creation audit by its caller-owned event key", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle({ edition: null });
    const result = await auditResult({ bottleId: bottle.id });
    vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
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

  test("keeps concurrent post-user-creation retries race-safe at persistence", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle({ edition: null });
    const result = await auditResult({ bottleId: bottle.id });
    let auditCalls = 0;
    let releaseAudits = () => {};
    const auditBarrier = new Promise<void>((resolve) => {
      releaseAudits = resolve;
    });
    vi.mocked(auditBottleWithServerAdapters).mockImplementation(async () => {
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

    expect(results.map((entry) => entry?.created).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0]?.check.id).toBe(results[1]?.check.id);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select({ id: bottleChecks.id })
        .from(bottleChecks)
        .where(eq(bottleChecks.backgroundEventKey, input.backgroundEventKey)),
    ).toHaveLength(1);
  });

  test("does not run or persist audits while shadow generation is disabled", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      runModeratorBottleAudit({ bottleId: bottle.id }),
    ).rejects.toBeInstanceOf(BottleAuditUnavailableError);
    await expect(
      runPostUserCreationBottleAudit({
        bottleId: bottle.id,
        backgroundEventKey: `bottle_created:${bottle.id}`,
      }),
    ).resolves.toBeNull();

    expect(auditBottleWithServerAdapters).not.toHaveBeenCalled();
    expect(
      await getBottleCheckHistory({
        intent: "audit_bottle",
        bottleId: bottle.id,
      }),
    ).toEqual([]);
  });

  test("keeps the existing reference-classification entrypoint exported", () => {
    expect(classifyBottleReference).toBeTypeOf("function");
  });
});
