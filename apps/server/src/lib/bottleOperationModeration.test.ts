import type { ProposedOperation } from "@peated/bottle-classifier";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  entities,
} from "@peated/server/db/schema";
import type { BottleCheckOperationCapabilities } from "@peated/server/lib/bottleCheckAvailableOperations";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import {
  approveBottleOperations,
  rejectBottleOperations,
  retryBottleOperation,
} from "@peated/server/lib/bottleOperationModeration";
import { prepareProposals } from "@peated/server/lib/bottleOperationReview";
import * as workerClient from "@peated/server/worker/client";
import mergeEntity from "@peated/server/worker/jobs/mergeEntity";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

const ALL_OPERATIONS: BottleCheckOperationCapabilities = {
  update_bottle: true,
  merge_bottles: true,
  update_entity: true,
  merge_entities: true,
};

function updateEntityProposal(
  entityId: number,
  name: string,
): ProposedOperation {
  return {
    type: "update_entity",
    input: { entityId, patch: { name } },
    rationale: "The inspected evidence confirms the canonical Entity name.",
    evidenceRefs: [{ kind: "entity", entityId }],
  };
}

async function createPreparedCheck({
  bottleId,
  proposals,
  inspectedEntities,
}: {
  bottleId: number;
  proposals: ProposedOperation[];
  inspectedEntities: Array<{ id: number; name: string }>;
}) {
  const artifacts = {
    candidates: [],
    searchEvidence: [],
    resolvedEntities: inspectedEntities.map((entity) => ({
      entityId: entity.id,
      name: entity.name,
    })),
    bottleContexts: [],
    entityContexts: inspectedEntities.map((entity) => ({
      entityId: entity.id,
      name: entity.name,
      shortName: null,
      roles: [],
      website: null,
      country: null,
      region: null,
      yearEstablished: null,
      aliases: [],
      relatedBottles: [],
    })),
  };
  const operations = await prepareProposals({
    proposals,
    artifacts,
    capabilities: ALL_OPERATIONS,
  });
  if (operations.some(({ status }) => status === "blocked")) {
    throw new Error(
      `Expected test operations to prepare: ${JSON.stringify(operations)}`,
    );
  }

  return await createBottleCheck({
    intent: "audit_bottle",
    input: { bottleId, origin: "moderator" },
    result: {
      summary: "Review the proposed catalog operations.",
      proposedOperations: proposals,
      findings: [],
      artifacts,
    },
    operations,
    model: "test-model",
  });
}

describe("Bottle operation moderation", () => {
  const originalExecutionFlag = config.BOTTLE_CHECK_EXECUTION;

  beforeEach(() => {
    config.BOTTLE_CHECK_EXECUTION = true;
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
    vi.mocked(workerClient.pushUniqueJob)
      .mockReset()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    config.BOTTLE_CHECK_EXECUTION = originalExecutionFlag;
  });

  test("rejects an unauthorized batch without changing any operation", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ name: "Unauthorized Before" });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateEntityProposal(entity.id, "Unauthorized After")],
      inspectedEntities: [entity],
    });
    const operation = created.check.operations[0]!;
    const user = await fixtures.User({ mod: false });

    await expect(
      approveBottleOperations(
        { checkId: created.check.id, operationIds: [operation.id] },
        user,
      ),
    ).rejects.toThrow("Moderator authorization is required");

    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({ status: "pending_review", reviewedById: null });
  });

  test("applies selected operations independently and does not redispatch a duplicate approval", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const firstEntity = await fixtures.Entity({ name: "First Before" });
    const secondEntity = await fixtures.Entity({ name: "Second Before" });
    const bottle = await fixtures.Bottle({ brandId: firstEntity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [
        updateEntityProposal(firstEntity.id, "First After"),
        updateEntityProposal(secondEntity.id, "Second After"),
      ],
      inspectedEntities: [firstEntity, secondEntity],
    });
    const [firstOperation, secondOperation] = created.check.operations;
    await db
      .update(bottleOperations)
      .set({ status: "rejected" })
      .where(eq(bottleOperations.id, secondOperation!.id));

    const results = await approveBottleOperations(
      {
        checkId: created.check.id,
        operationIds: [firstOperation!.id, secondOperation!.id],
      },
      moderator,
    );

    expect(results).toEqual([
      { operationId: firstOperation!.id, status: "applied", error: null },
      {
        operationId: secondOperation!.id,
        status: "rejected",
        error: expect.stringContaining("cannot be approved"),
      },
    ]);
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, firstEntity.id),
      }),
    ).toMatchObject({ name: "First After" });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, secondEntity.id),
      }),
    ).toMatchObject({ name: "Second Before" });

    expect(
      await approveBottleOperations(
        {
          checkId: created.check.id,
          operationIds: [firstOperation!.id],
        },
        moderator,
      ),
    ).toEqual([
      {
        operationId: firstOperation!.id,
        status: "applied",
        error: expect.stringContaining("cannot be approved"),
      },
    ]);
  });

  test("marks relevant drift stale but permits unrelated catalog drift", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const staleEntity = await fixtures.Entity({ name: "Stale Before" });
    const validEntity = await fixtures.Entity({ name: "Valid Before" });
    const bottle = await fixtures.Bottle({ brandId: staleEntity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [
        updateEntityProposal(staleEntity.id, "Stale Proposed"),
        updateEntityProposal(validEntity.id, "Valid Proposed"),
      ],
      inspectedEntities: [staleEntity, validEntity],
    });
    await db
      .update(entities)
      .set({ name: "Stale Manual Change" })
      .where(eq(entities.id, staleEntity.id));
    await db
      .update(entities)
      .set({ description: "Unrelated enrichment" })
      .where(eq(entities.id, validEntity.id));

    const results = await approveBottleOperations(
      {
        checkId: created.check.id,
        operationIds: created.check.operations.map(({ id }) => id),
      },
      moderator,
    );

    expect(results.map(({ status }) => status)).toEqual(["stale", "applied"]);
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, staleEntity.id),
      }),
    ).toMatchObject({ name: "Stale Manual Change" });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, validEntity.id),
      }),
    ).toMatchObject({
      name: "Valid Proposed",
      description: "Unrelated enrichment",
    });
  });

  test("records unexpected preparation failures as failed rather than stale", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Preparation Before" });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateEntityProposal(entity.id, "Preparation After")],
      inspectedEntities: [entity],
    });
    const operation = created.check.operations[0]!;
    await db
      .update(bottleChecks)
      .set({ artifacts: { candidates: "invalid" } })
      .where(eq(bottleChecks.id, created.check.id));

    expect(
      await approveBottleOperations(
        { checkId: created.check.id, operationIds: [operation.id] },
        moderator,
      ),
    ).toEqual([
      {
        operationId: operation.id,
        status: "failed",
        error: "Canonical Bottle operation execution failed.",
      },
    ]);
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({
      status: "failed",
      error: "Canonical Bottle operation execution failed.",
    });
  });

  test("persists approval before async dispatch and safely retries dispatch failure with the same id", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const source = await fixtures.Entity({ name: "Merge Source" });
    const destination = await fixtures.Entity({ name: "Merge Destination" });
    const bottle = await fixtures.Bottle({ brandId: destination.id });
    const proposal: ProposedOperation = {
      type: "merge_entities",
      input: {
        sourceEntityId: source.id,
        destinationEntityId: destination.id,
      },
      rationale: "The inspected records are the same Entity.",
      evidenceRefs: [
        { kind: "entity", entityId: source.id },
        { kind: "entity", entityId: destination.id },
      ],
    };
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [proposal],
      inspectedEntities: [source, destination],
    });
    const operation = created.check.operations[0]!;
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("queue unavailable"),
    );

    expect(
      await approveBottleOperations(
        { checkId: created.check.id, operationIds: [operation.id] },
        moderator,
      ),
    ).toEqual([
      {
        operationId: operation.id,
        status: "failed",
        error: "Bottle operation dispatch failed.",
      },
    ]);
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({
      status: "failed",
      reviewedById: moderator.id,
      result: {
        type: "merge_entities",
        status: "applying",
        operationId: operation.id,
      },
    });

    expect(
      await retryBottleOperation(
        { checkId: created.check.id, operationId: operation.id },
        moderator,
      ),
    ).toEqual({ operationId: operation.id, status: "applying", error: null });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    expect(workerClient.pushJob).toHaveBeenNthCalledWith(
      1,
      "MergeEntity",
      {
        operationId: operation.id,
        approvingModeratorId: moderator.id,
      },
      expect.objectContaining({
        jobId: `MergeEntity-operation-${operation.id}`,
      }),
    );
    expect(workerClient.pushJob).toHaveBeenNthCalledWith(
      2,
      "MergeEntity",
      {
        operationId: operation.id,
        approvingModeratorId: moderator.id,
      },
      expect.objectContaining({
        jobId: `MergeEntity-operation-${operation.id}`,
      }),
    );
  });

  test("runs an approved Entity merge through the real worker to canonical applied state", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const source = await fixtures.Entity({
      name: "Worker Merge Source",
      type: ["distiller"],
    });
    const destination = await fixtures.Entity({
      name: "Worker Merge Destination",
      type: ["brand"],
    });
    const bottle = await fixtures.Bottle({
      brandId: destination.id,
      distillerIds: [source.id],
    });
    const proposal: ProposedOperation = {
      type: "merge_entities",
      input: {
        sourceEntityId: source.id,
        destinationEntityId: destination.id,
      },
      rationale: "The inspected records are the same Entity.",
      evidenceRefs: [
        { kind: "entity", entityId: source.id },
        { kind: "entity", entityId: destination.id },
      ],
    };
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [proposal],
      inspectedEntities: [source, destination],
    });
    const operation = created.check.operations[0]!;

    expect(
      await approveBottleOperations(
        { checkId: created.check.id, operationIds: [operation.id] },
        moderator,
      ),
    ).toEqual([{ operationId: operation.id, status: "applying", error: null }]);
    const dispatchedInput = vi.mocked(workerClient.pushJob).mock.calls[0]?.[1];
    expect(dispatchedInput).toEqual({
      operationId: operation.id,
      approvingModeratorId: moderator.id,
    });

    await mergeEntity(dispatchedInput);

    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({
      status: "applied",
      error: null,
      result: {
        type: "merge_entities",
        sourceEntityId: source.id,
        destinationEntityId: destination.id,
        destinationRoles: ["brand", "distiller"],
        approvingModeratorId: moderator.id,
        reconciled: false,
        execution: { kind: "worker", name: "MergeEntity" },
      },
      executionCompletedAt: expect.any(Date),
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, source.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, destination.id),
      }),
    ).toMatchObject({ type: ["brand", "distiller"] });
  });

  test("validates rejection feedback and rejects selected operations independently", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const firstEntity = await fixtures.Entity({ name: "Reject First" });
    const secondEntity = await fixtures.Entity({ name: "Reject Second" });
    const bottle = await fixtures.Bottle({ brandId: firstEntity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [
        updateEntityProposal(firstEntity.id, "Rejected First"),
        updateEntityProposal(secondEntity.id, "Rejected Second"),
      ],
      inspectedEntities: [firstEntity, secondEntity],
    });
    const [firstOperation, secondOperation] = created.check.operations;
    await db
      .update(bottleOperations)
      .set({ status: "applied" })
      .where(eq(bottleOperations.id, secondOperation!.id));

    await expect(
      rejectBottleOperations(
        {
          checkId: created.check.id,
          operationIds: [firstOperation!.id],
          reason: "other",
        },
        moderator,
      ),
    ).rejects.toThrow("note is required");

    const results = await rejectBottleOperations(
      {
        checkId: created.check.id,
        operationIds: [firstOperation!.id, secondOperation!.id],
        reason: "other",
        note: "The public evidence is ambiguous.",
      },
      moderator,
    );
    expect(results).toEqual([
      { operationId: firstOperation!.id, status: "rejected", error: null },
      {
        operationId: secondOperation!.id,
        status: "applied",
        error: expect.stringContaining("cannot be rejected"),
      },
    ]);
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, firstOperation!.id),
      }),
    ).toMatchObject({
      rejectionReason: "other",
      reviewerNote: "The public evidence is ambiguous.",
      reviewedById: moderator.id,
    });
  });

  test("keeps closed checks immutable and forbids retries outside failed", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Closed Before" });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateEntityProposal(entity.id, "Closed After")],
      inspectedEntities: [entity],
    });
    const operation = created.check.operations[0]!;

    expect(
      await retryBottleOperation(
        { checkId: created.check.id, operationId: operation.id },
        moderator,
      ),
    ).toEqual({
      operationId: operation.id,
      status: "pending_review",
      error: expect.stringContaining("cannot be retried"),
    });

    await db
      .update(bottleChecks)
      .set({ closedAt: new Date(), closeReason: "dismissed" })
      .where(eq(bottleChecks.id, created.check.id));
    expect(
      await approveBottleOperations(
        { checkId: created.check.id, operationIds: [operation.id] },
        moderator,
      ),
    ).toEqual([
      {
        operationId: operation.id,
        status: "pending_review",
        error: expect.stringContaining("is closed"),
      },
    ]);
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Closed Before" });
  });

  test("reconciles a confirmed result and leaves indeterminate failed work failed", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const confirmedEntity = await fixtures.Entity({ name: "Confirmed Before" });
    const indeterminateEntity = await fixtures.Entity({
      name: "Indeterminate Before",
    });
    const bottle = await fixtures.Bottle({ brandId: confirmedEntity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [
        updateEntityProposal(confirmedEntity.id, "Confirmed After"),
        updateEntityProposal(indeterminateEntity.id, "Indeterminate After"),
      ],
      inspectedEntities: [confirmedEntity, indeterminateEntity],
    });
    const [confirmedOperation, indeterminateOperation] =
      created.check.operations;
    await db
      .update(entities)
      .set({ name: "Confirmed After" })
      .where(eq(entities.id, confirmedEntity.id));
    await db
      .update(bottleOperations)
      .set({
        status: "failed",
        reviewedById: moderator.id,
        reviewedAt: new Date(),
        result: {
          type: "update_entity",
          status: "applied",
          entityId: confirmedEntity.id,
          changed: true,
        },
      })
      .where(eq(bottleOperations.id, confirmedOperation!.id));
    await db
      .update(bottleOperations)
      .set({
        status: "failed",
        reviewedById: moderator.id,
        reviewedAt: new Date(),
        stateToken: null,
      })
      .where(eq(bottleOperations.id, indeterminateOperation!.id));

    expect(
      await retryBottleOperation(
        {
          checkId: created.check.id,
          operationId: confirmedOperation!.id,
        },
        moderator,
      ),
    ).toEqual({
      operationId: confirmedOperation!.id,
      status: "applied",
      error: null,
    });
    expect(
      await retryBottleOperation(
        {
          checkId: created.check.id,
          operationId: indeterminateOperation!.id,
        },
        moderator,
      ),
    ).toEqual({
      operationId: indeterminateOperation!.id,
      status: "failed",
      error: "Prior Bottle operation execution could not be reconciled.",
    });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, indeterminateOperation!.id),
      }),
    ).toMatchObject({
      status: "failed",
      error: "Prior Bottle operation execution could not be reconciled.",
    });
  });
});
