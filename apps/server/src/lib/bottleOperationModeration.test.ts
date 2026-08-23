import {
  ProposedOperationSchema,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import * as schema from "@peated/server/db/schema";
import {
  bottleChecks,
  bottleOperations,
  bottles,
  entities,
} from "@peated/server/db/schema";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import {
  approveBottleOperations,
  prepareBottleCheckReviewOperations,
  rejectBottleOperations,
  retryBottleOperation,
} from "@peated/server/lib/bottleOperationModeration";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import mergeEntity from "@peated/server/worker/jobs/mergeEntity";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND $1 = ANY(pg_blocking_pids(pid))
       ORDER BY pid
       LIMIT 1`,
      [blockerPid],
    );
    if (result.rows[0]) return result.rows[0].pid;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Bottle approval lock.");
}

async function waitForSessionToBlockOn(
  client: NodePgClient,
  blockedPid: number,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT $2 = ANY(pg_blocking_pids($1)) AS blocked`,
      [blockedPid, blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(
    `Timed out waiting for session ${blockedPid} to block on session ${blockerPid}.`,
  );
}

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

function updateBottleAbvProposal(
  bottleId: number,
  abv: number,
): ProposedOperation {
  return {
    type: "update_bottle",
    input: { bottleId, patch: { abv } },
    rationale: "The inspected label confirms the Bottle ABV.",
    evidenceRefs: [{ kind: "bottle", bottleId }],
  };
}

function updateBottleBrandProposal(
  bottleId: number,
  brandId: number,
): ProposedOperation {
  return {
    type: "update_bottle",
    input: {
      bottleId,
      patch: {
        brand: { kind: "existing", entityId: brandId },
      },
    },
    rationale: "The inspected catalog records confirm the canonical Brand.",
    evidenceRefs: [
      { kind: "bottle", bottleId },
      { kind: "entity", entityId: brandId },
    ],
  };
}

async function createPreparedCheck({
  bottleId,
  proposals,
  inspectedBottleIds = [],
  inspectedEntities,
}: {
  bottleId: number;
  proposals: ProposedOperation[];
  inspectedBottleIds?: number[];
  inspectedEntities: Array<{ id: number; name: string }>;
}) {
  const bottleContexts = await Promise.all(
    inspectedBottleIds.map(async (inspectedBottleId) => {
      const context = await getBottleClassifierContext(inspectedBottleId);
      if (!context) {
        throw new Error(`Missing Bottle context for ${inspectedBottleId}`);
      }
      const { imageSources: _imageSources, ...fields } = context;
      return { ...fields, publicImages: [] };
    }),
  );
  const artifacts = {
    candidates: [],
    searchEvidence: [],
    resolvedEntities: inspectedEntities.map((entity) => ({
      entityId: entity.id,
      name: entity.name,
    })),
    bottleContexts,
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
  const created = await createBottleCheck({
    intent: "audit_bottle",
    input: { bottleId, origin: "moderator" },
    result: {
      summary: "Review the proposed catalog operations.",
      proposedOperations: proposals,
      findings: [],
      artifacts,
    },
    model: "test-model",
  });
  if (created.check.operations.some(({ status }) => status === "blocked")) {
    throw new Error(
      `Expected test operations to prepare: ${JSON.stringify(created.check.operations)}`,
    );
  }
  return created;
}

describe("Bottle operation moderation", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
    vi.mocked(workerClient.pushUniqueJob)
      .mockReset()
      .mockResolvedValue(undefined);
  });

  test("keeps unsupported check versions non-executable", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ name: "Versioned Before" });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const moderator = await fixtures.User({ mod: true });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateEntityProposal(entity.id, "Versioned After")],
      inspectedEntities: [entity],
    });
    const operation = created.check.operations[0]!;
    const unsupportedCheck = {
      ...created.check,
      schemaVersion: created.check.schemaVersion + 1,
      operations: [
        {
          ...operation,
          // SAFETY: This test restores a retired proposal shape from stored JSON.
          proposal: {
            legacyOperation: "rename_entity",
            arguments: [entity.id, "Versioned After"],
          } as never,
        },
      ],
    };
    await db
      .update(bottleChecks)
      .set({ schemaVersion: unsupportedCheck.schemaVersion })
      .where(eq(bottleChecks.id, created.check.id));

    await expect(
      prepareBottleCheckReviewOperations(unsupportedCheck),
    ).resolves.toEqual([]);
    await expect(
      approveBottleOperations(
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
        moderator,
      ),
    ).resolves.toEqual([
      {
        operationId: operation.id,
        status: "pending_review",
        error: expect.stringContaining("uses unsupported schema version"),
      },
    ]);
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
        columns: { name: true },
      }),
    ).toEqual({ name: "Versioned Before" });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
        columns: { status: true },
      }),
    ).toEqual({ status: "pending_review" });
  });

  test("does not rebuild live previews for applying operations", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ name: "Applying Entity" });
    const bottle = await fixtures.Bottle();
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateEntityProposal(entity.id, "Applied Entity")],
      inspectedEntities: [entity],
    });
    const operation = created.check.operations[0]!;
    await db
      .update(bottleOperations)
      .set({ status: "applying" })
      .where(eq(bottleOperations.id, operation.id));
    const applyingCheck = await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.id, created.check.id),
      with: { operations: true },
    });
    if (!applyingCheck) throw new Error("Expected persisted Bottle check.");

    await expect(
      prepareBottleCheckReviewOperations(applyingCheck),
    ).resolves.toEqual([
      {
        operationId: operation.id,
        review: null,
        approvalReady: false,
      },
    ]);
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
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
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
        operations: [
          { operationId: firstOperation!.id },
          { operationId: secondOperation!.id },
        ],
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
          operations: [{ operationId: firstOperation!.id }],
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

  test("applies an exact Bottle update when its reviewed state is unchanged", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ abv: 40 });
    const proposal = updateBottleAbvProposal(bottle.id, 46);
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [proposal],
      inspectedBottleIds: [bottle.id],
      inspectedEntities: [],
    });
    const operation = created.check.operations[0]!;

    expect(
      await approveBottleOperations(
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
        moderator,
      ),
    ).toEqual([{ operationId: operation.id, status: "applied", error: null }]);
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ abv: 46 });
  });

  test("marks an exact Bottle update stale when a concurrent edit commits first", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ abv: 40 });
    if (bottle.groupId === null) throw new Error("Expected a BottleGroup.");
    const proposal = updateBottleAbvProposal(bottle.id, 46);
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [proposal],
      inspectedBottleIds: [bottle.id],
      inspectedEntities: [],
    });
    const operation = created.check.operations[0]!;
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let approval: ReturnType<typeof approveBottleOperations> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `SELECT "id" FROM "bottle_group" WHERE "id" = $1 FOR UPDATE`,
        [bottle.groupId],
      );
      await client.query(
        `SELECT "id" FROM "bottle" WHERE "id" = $1 FOR UPDATE`,
        [bottle.id],
      );
      await client.query(`UPDATE "bottle" SET "abv" = $1 WHERE "id" = $2`, [
        47,
        bottle.id,
      ]);

      approval = approveBottleOperations(
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
        moderator,
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;
      await approval;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await approval?.catch(() => undefined);
    }

    await expect(approval).resolves.toEqual([
      { operationId: operation.id, status: "stale", error: null },
    ]);
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ abv: 47 });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({ status: "stale" });
  });

  test("marks an Entity update stale when a concurrent edit commits before live preparation", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Concurrent Entity Before" });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const created = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateEntityProposal(entity.id, "Proposed Entity Name")],
      inspectedEntities: [entity],
    });
    const operation = created.check.operations[0]!;
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let approval: ReturnType<typeof approveBottleOperations> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(`UPDATE "entity" SET "name" = $1 WHERE "id" = $2`, [
        "Concurrent Entity Change",
        entity.id,
      ]);

      approval = approveBottleOperations(
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
        moderator,
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;
      await approval;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await approval?.catch(() => undefined);
    }

    await expect(approval).resolves.toEqual([
      { operationId: operation.id, status: "stale", error: null },
    ]);
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Concurrent Entity Change" });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({ status: "stale" });
  });

  test("serializes a shared Bottle update behind an Entity merge before locking its BottleGroup", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const source = await fixtures.Entity({
      name: "Concurrent Merge Source",
      type: ["brand"],
    });
    const destination = await fixtures.Entity({
      name: "Concurrent Merge Destination",
      type: ["brand"],
    });
    const bottle = await fixtures.Bottle({ brandId: source.id });
    if (bottle.groupId === null) throw new Error("Expected a BottleGroup.");

    const updateProposal = updateBottleBrandProposal(bottle.id, destination.id);
    const updateCheck = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [updateProposal],
      inspectedBottleIds: [bottle.id],
      inspectedEntities: [destination],
    });
    const updateOperation = updateCheck.check.operations[0]!;
    const mergeProposal: ProposedOperation = {
      type: "merge_entities",
      input: {
        sourceEntityId: source.id,
        destinationEntityId: destination.id,
      },
      rationale: "The inspected records represent the same Entity.",
      evidenceRefs: [
        { kind: "entity", entityId: source.id },
        { kind: "entity", entityId: destination.id },
      ],
    };
    const mergeCheck = await createPreparedCheck({
      bottleId: bottle.id,
      proposals: [mergeProposal],
      inspectedEntities: [source, destination],
    });
    const mergeOperation = mergeCheck.check.operations[0]!;

    expect(
      await approveBottleOperations(
        {
          checkId: mergeCheck.check.id,
          operations: [{ operationId: mergeOperation.id }],
        },
        moderator,
      ),
    ).toEqual([
      { operationId: mergeOperation.id, status: "applying", error: null },
    ]);
    const dispatchedInput = vi.mocked(workerClient.pushJob).mock.calls[0]?.[1];

    const client = new Client(getPostgresConnectionConfig());
    const updatePool = new pg.Pool({
      ...getPostgresConnectionConfig(),
      max: 1,
    });
    const updateDatabase = drizzle(updatePool, { schema });
    const updatePid = (
      await updatePool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ).rows[0]!.pid;
    let committed = false;
    let mergeRun: Promise<unknown> | undefined;
    let updateApproval: ReturnType<typeof approveBottleOperations> | undefined;
    let mergeResult: unknown;
    let updateResult: Awaited<ReturnType<typeof approveBottleOperations>>;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `SELECT "id" FROM "bottle_group" WHERE "id" = $1 FOR UPDATE`,
        [bottle.groupId],
      );

      mergeRun = mergeEntity(dispatchedInput);
      const mergePid = await waitForSessionBlockedBy(client, blockerPid);

      updateApproval = approveBottleOperations(
        {
          checkId: updateCheck.check.id,
          operations: [{ operationId: updateOperation.id }],
        },
        moderator,
        updateDatabase,
      );
      await Promise.race([
        waitForSessionToBlockOn(client, updatePid, mergePid),
        updateApproval.then((result) => {
          throw new Error(
            `Bottle approval completed before taking its Entity dependency lock: ${JSON.stringify(result)}`,
          );
        }),
      ]);

      await client.query("COMMIT");
      committed = true;
      [mergeResult, updateResult] = await Promise.all([
        mergeRun,
        updateApproval,
      ]);
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await Promise.allSettled(
        [mergeRun, updateApproval].filter(
          (promise): promise is Promise<unknown> => promise !== undefined,
        ),
      );
      await updatePool.end();
    }

    expect(mergeResult).toMatchObject({
      sourceEntityId: source.id,
      destinationEntityId: destination.id,
    });
    expect(updateResult).toEqual([
      { operationId: updateOperation.id, status: "stale", error: null },
    ]);
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ brandId: destination.id });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, source.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, updateOperation.id),
      }),
    ).toMatchObject({ status: "stale" });
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

    expect(
      await prepareBottleCheckReviewOperations(created.check),
    ).toMatchObject([
      { operationId: created.check.operations[0]!.id, approvalReady: false },
      { operationId: created.check.operations[1]!.id, approvalReady: true },
    ]);
    expect(
      await db.query.bottleOperations.findMany({
        where: eq(bottleOperations.checkId, created.check.id),
      }),
    ).toEqual([
      expect.objectContaining({ status: "pending_review" }),
      expect.objectContaining({ status: "pending_review" }),
    ]);

    const results = await approveBottleOperations(
      {
        checkId: created.check.id,
        operations: created.check.operations.map(({ id: operationId }) => ({
          operationId,
        })),
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
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
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
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
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
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
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

  for (const approvalOrder of ["update_first", "merge_first"] as const) {
    test(`keeps destination metadata independent when approving ${approvalOrder.replace("_", " ")}`, async ({
      fixtures,
    }) => {
      const moderator = await fixtures.User({ mod: true });
      const source = await fixtures.Entity({
        name: `Independent Source ${approvalOrder}`,
        type: ["brand"],
      });
      const destination = await fixtures.Entity({
        name: `Independent Destination ${approvalOrder}`,
        type: ["brand"],
      });
      const country = await fixtures.Country({
        name: `Independent Country ${approvalOrder}`,
      });
      const region = await fixtures.Region({
        countryId: country.id,
        name: `Independent Region ${approvalOrder}`,
      });
      const bottle = await fixtures.Bottle({ brandId: source.id });
      const website = `https://example.com/${approvalOrder}`;
      const mergeProposal: ProposedOperation = {
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
      const updateProposal: ProposedOperation = {
        type: "update_entity",
        input: {
          entityId: destination.id,
          patch: {
            website,
            country: country.name,
            region: region.name,
            yearEstablished: 1815,
          },
        },
        rationale: "The inspected evidence confirms descriptive metadata.",
        evidenceRefs: [{ kind: "entity", entityId: destination.id }],
      };
      const created = await createPreparedCheck({
        bottleId: bottle.id,
        proposals: [mergeProposal, updateProposal],
        inspectedEntities: [source, destination],
      });
      const mergeOperation = created.check.operations.find(
        (operation) =>
          ProposedOperationSchema.parse(operation.proposal).type ===
          "merge_entities",
      );
      const updateOperation = created.check.operations.find(
        (operation) =>
          ProposedOperationSchema.parse(operation.proposal).type ===
          "update_entity",
      );
      if (!mergeOperation || !updateOperation) {
        throw new Error("Expected both independent Entity operations.");
      }
      const operationIds =
        approvalOrder === "update_first"
          ? [updateOperation.id, mergeOperation.id]
          : [mergeOperation.id, updateOperation.id];

      for (const operationId of operationIds) {
        expect(
          await approveBottleOperations(
            { checkId: created.check.id, operations: [{ operationId }] },
            moderator,
          ),
        ).toEqual([
          {
            operationId,
            status: operationId === mergeOperation.id ? "applying" : "applied",
            error: null,
          },
        ]);
      }

      await mergeEntity({
        operationId: mergeOperation.id,
        approvingModeratorId: moderator.id,
      });

      const completedOperations = await db.query.bottleOperations.findMany({
        where: eq(bottleOperations.checkId, created.check.id),
        columns: { id: true, status: true },
      });
      expect(completedOperations).toHaveLength(2);
      expect(completedOperations).toEqual(
        expect.arrayContaining([
          { id: mergeOperation.id, status: "applied" },
          { id: updateOperation.id, status: "applied" },
        ]),
      );
      expect(
        await db.query.entities.findFirst({
          where: eq(entities.id, source.id),
        }),
      ).toBeUndefined();
      expect(
        await db.query.entities.findFirst({
          where: eq(entities.id, destination.id),
        }),
      ).toMatchObject({
        website,
        countryId: country.id,
        regionId: region.id,
        yearEstablished: 1815,
      });
      expect(
        await db.query.bottles.findFirst({
          where: eq(bottles.id, bottle.id),
        }),
      ).toMatchObject({ brandId: destination.id });
    });
  }

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
        {
          checkId: created.check.id,
          operations: [{ operationId: operation.id }],
        },
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
