import type { MergeEntitiesOperation } from "@peated/bottle-classifier";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  actors,
  bottleChecks,
  bottleGroupDistillers,
  bottleGroups,
  bottleOperations,
  bottles,
  bottleSeries,
  bottleTombstones,
  changes,
  entities,
  entityAliases,
  entityTombstones,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  type User,
} from "@peated/server/db/schema";
import {
  BOTTLE_CHECK_SCHEMA_VERSION,
  createBottleCheck,
} from "@peated/server/lib/bottleChecks";
import { prepareOperation } from "@peated/server/lib/bottleOperationReview";
import { createBottle } from "@peated/server/lib/createBottle";
import { loadEntityMergeOperation } from "@peated/server/lib/entityMergeOperation";
import { createLegacyStorePriceReviewCheck } from "@peated/server/lib/test/legacyBottleChecks";
import { pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
import type { Context } from "@peated/server/orpc/context";
import { and, eq, inArray } from "drizzle-orm";
import pg from "pg";
import { beforeEach, expect, vi } from "vitest";
import mergeEntity from "./mergeEntity";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND $1 = ANY(pg_blocking_pids(pid))
       ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Entity merge lock.");
}

async function deleteDestinationWhileMergeWaits<TResult>(
  destinationEntityId: number,
  runMerge: () => Promise<TResult>,
): Promise<void> {
  const blocker = new Client(getPostgresConnectionConfig());
  let committed = false;
  let mergeRun: Promise<TResult> | undefined;

  await blocker.connect();
  try {
    await blocker.query("BEGIN");
    const blockerPid = (
      await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ).rows[0]!.pid;
    await blocker.query(`DELETE FROM "entity_alias" WHERE "entity_id" = $1`, [
      destinationEntityId,
    ]);
    await blocker.query(`DELETE FROM "entity" WHERE "id" = $1`, [
      destinationEntityId,
    ]);

    mergeRun = runMerge();
    await waitForSessionBlockedBy(blocker, blockerPid);

    await blocker.query("COMMIT");
    committed = true;
    await mergeRun;
  } finally {
    if (!committed) await blocker.query("ROLLBACK");
    await blocker.end();
    await mergeRun?.catch(() => undefined);
  }
}

function contextFor(user: User) {
  return { user } satisfies Context & { user: NonNullable<Context["user"]> };
}

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

beforeEach(async ({ fixtures }) => {
  await fixtures.User({ admin: true, username: "dcramer" });
});

test("preserves current ownership and repoints owned Entities", async ({
  fixtures,
}) => {
  const owner = await fixtures.Entity({ kind: "company" });
  const source = await fixtures.Entity({ ownerId: owner.id });
  const destination = await fixtures.Entity();
  const owned = await fixtures.Entity({ ownerId: source.id });

  await mergeEntity({
    fromEntityIds: [source.id],
    toEntityId: destination.id,
  });

  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, destination.id),
    }),
  ).toMatchObject({ ownerId: owner.id });
  expect(
    await db.query.entities.findFirst({ where: eq(entities.id, owned.id) }),
  ).toMatchObject({ ownerId: destination.id });
});

test("rejects a merge with conflicting current owners", async ({
  fixtures,
}) => {
  const firstOwner = await fixtures.Entity({ kind: "company" });
  const secondOwner = await fixtures.Entity({ kind: "company" });
  const source = await fixtures.Entity({ ownerId: firstOwner.id });
  const destination = await fixtures.Entity({ ownerId: secondOwner.id });

  await expect(
    mergeEntity({
      fromEntityIds: [source.id],
      toEntityId: destination.id,
    }),
  ).rejects.toThrow("Cannot merge Entities with different current owners.");

  expect(
    await db.query.entities.findFirst({ where: eq(entities.id, source.id) }),
  ).toMatchObject({ ownerId: firstOwner.id });
  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, destination.id),
    }),
  ).toMatchObject({ ownerId: secondOwner.id });
});

test("removes ownership that would become self ownership after a merge", async ({
  fixtures,
}) => {
  const source = await fixtures.Entity();
  const destination = await fixtures.Entity({ ownerId: source.id });

  await mergeEntity({
    fromEntityIds: [source.id],
    toEntityId: destination.id,
  });

  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, destination.id),
    }),
  ).toMatchObject({ ownerId: null });
});

async function createApplyingEntityMergeOperation({
  approvingModeratorId,
  bottleId,
  destinationEntityId,
  sourceEntityId,
  storePrice,
}: {
  approvingModeratorId: number;
  bottleId: number;
  destinationEntityId: number;
  sourceEntityId: number;
  storePrice?: {
    attemptId: number;
    priceId: number;
    priceName: string;
  };
}) {
  const proposal: MergeEntitiesOperation = {
    type: "merge_entities",
    input: {
      sourceEntityId,
      destinationEntityId,
    },
    rationale: "The inspected Entities are exact duplicates.",
    evidenceRefs: [
      { kind: "entity", entityId: sourceEntityId },
      { kind: "entity", entityId: destinationEntityId },
    ],
  };
  const inspectedEntities = await db
    .select({ entityId: entities.id, name: entities.name })
    .from(entities)
    .where(inArray(entities.id, [sourceEntityId, destinationEntityId]));
  const artifacts = {
    resolvedEntities: inspectedEntities,
    entityContexts: inspectedEntities.map((entity) => ({
      ...entity,
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
  const created = storePrice
    ? await createLegacyStorePriceReviewCheck({
        artifacts,
        bottleId,
        price: { id: storePrice.priceId, name: storePrice.priceName },
        proposal,
        storePriceAttemptId: storePrice.attemptId,
      })
    : await createBottleCheck({
        intent: "audit_bottle",
        input: {
          bottleId,
          origin: "moderator",
        },
        result: {
          summary: "Merge the duplicate Entity.",
          proposedOperations: [proposal],
          findings: [],
          artifacts,
        },
      });
  const operation = created.check.operations[0]!;
  if (operation.status === "blocked") {
    throw new Error(
      `Expected Entity merge operation preparation to succeed: ${JSON.stringify({ inspectedEntities, operation })}`,
    );
  }

  const [applying] = await db
    .update(bottleOperations)
    .set({
      status: "applying",
      reviewedById: approvingModeratorId,
      reviewedAt: new Date(),
      executionStartedAt: new Date(),
      result: {
        type: "merge_entities",
        status: "applying",
        operationId: operation.id,
        sourceEntityId,
        destinationEntityId,
        approvingModeratorId,
      },
    })
    .where(eq(bottleOperations.id, operation.id))
    .returning();
  return applying;
}

test("validates persisted Entity merge results by lifecycle state", async ({
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({ name: "Matrix Source" });
  const destinationEntity = await fixtures.Entity({
    name: "Matrix Destination",
  });
  const bottle = await fixtures.Bottle({ brandId: destinationEntity.id });
  const moderator = await fixtures.User({ mod: true });
  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
  });
  const dispatchResult = operation.result;
  const terminalResult = {
    type: "merge_entities",
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
    destinationRoles: destinationEntity.type,
    approvingModeratorId: moderator.id,
    reconciled: false,
    execution: { kind: "worker", name: "MergeEntity" },
  };
  const loadOperation = () =>
    loadEntityMergeOperation({
      operationId: operation.id,
      approvingModeratorId: moderator.id,
    });

  await db
    .update(bottleOperations)
    .set({ status: "applying", result: null })
    .where(eq(bottleOperations.id, operation.id));
  await expect(loadOperation()).rejects.toThrow(
    "has an invalid dispatch result",
  );

  await db
    .update(bottleOperations)
    .set({ status: "applying", result: dispatchResult })
    .where(eq(bottleOperations.id, operation.id));
  await expect(loadOperation()).resolves.toMatchObject({
    status: "applying",
    result: null,
  });

  for (const result of [null, dispatchResult]) {
    await db
      .update(bottleOperations)
      .set({ status: "failed", result })
      .where(eq(bottleOperations.id, operation.id));
    await expect(loadOperation()).resolves.toMatchObject({
      status: "failed",
      result: null,
    });
  }

  await db
    .update(bottleOperations)
    .set({ status: "applied", result: terminalResult })
    .where(eq(bottleOperations.id, operation.id));
  await expect(loadOperation()).resolves.toMatchObject({
    status: "applied",
    result: terminalResult,
  });

  await db
    .update(bottleOperations)
    .set({ status: "applied", result: dispatchResult })
    .where(eq(bottleOperations.id, operation.id));
  await expect(loadOperation()).rejects.toThrow("has no valid applied result");
});

test("fails an operation when its check schema version is unsupported", async ({
  fixtures,
}) => {
  const unsupportedSchemaVersion = BOTTLE_CHECK_SCHEMA_VERSION + 1;
  const sourceEntity = await fixtures.Entity({ name: "Version Source" });
  const destinationEntity = await fixtures.Entity({
    name: "Version Destination",
  });
  const bottle = await fixtures.Bottle({ brandId: destinationEntity.id });
  const moderator = await fixtures.User({ mod: true });
  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
  });
  await db
    .update(bottleChecks)
    .set({ schemaVersion: unsupportedSchemaVersion })
    .where(eq(bottleChecks.id, operation.checkId));

  await mergeEntity({
    operationId: operation.id,
    approvingModeratorId: moderator.id,
  });

  expect(
    await db.query.bottleOperations.findFirst({
      where: eq(bottleOperations.id, operation.id),
      columns: { status: true, error: true },
    }),
  ).toEqual({
    status: "failed",
    error: expect.stringContaining(
      `uses unsupported schema version ${unsupportedSchemaVersion}`,
    ),
  });
  expect(
    await db.query.entities.findMany({
      where: inArray(entities.id, [sourceEntity.id, destinationEntity.id]),
    }),
  ).toHaveLength(2);
});

test("merge A into B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeUndefined();

  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeDefined();

  const [tombstone] = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, entityA.id));
  expect(tombstone.newEntityId).toEqual(newEntityB.id);
});

test("preserves generated Bottle content during an equivalent Entity merge", async ({
  fixtures,
}) => {
  const source = await fixtures.Entity({
    name: "Legacy Bottler Name",
    type: ["bottler"],
  });
  const destination = await fixtures.Entity({
    name: "Canonical Bottler Name",
    type: ["bottler"],
  });
  const bottle = await fixtures.Bottle({ bottlerId: source.id });
  const tastingNotes = {
    nose: "Preserved nose",
    palate: "Preserved palate",
    finish: "Preserved finish",
  };
  await db
    .update(bottles)
    .set({
      description: "Preserved generated description",
      descriptionSrc: "generated",
      suggestedTags: ["smoke"],
      tastingNotes,
    })
    .where(eq(bottles.id, bottle.id));
  vi.mocked(pushUniqueJob).mockClear();

  await mergeEntity({
    fromEntityIds: [source.id],
    toEntityId: destination.id,
  });

  expect(
    await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
  ).toMatchObject({
    bottlerId: destination.id,
    description: "Preserved generated description",
    descriptionSrc: "generated",
    suggestedTags: ["smoke"],
    tastingNotes,
  });
  expect(pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
    bottleId: bottle.id,
  });
});

test("merges an SMWS collision while replacing a duplicate distiller", async ({
  fixtures,
}) => {
  const smws = await fixtures.Entity({
    name: "SMWS",
    shortName: "SMWS",
    type: ["brand", "bottler"],
  });
  const destination = await fixtures.Entity({
    name: "Balcones Distilling",
    shortName: "Balcones",
    type: ["distiller"],
  });
  const source = await fixtures.Entity({
    name: "Balcones",
    type: ["distiller"],
  });
  const canonicalBottle = await fixtures.Bottle({
    brandId: smws.id,
    bottlerId: smws.id,
    name: "140.17 Bowled over by something beautiful",
    distillerIds: [destination.id],
  });
  const duplicateBottle = await fixtures.Bottle({
    brandId: smws.id,
    bottlerId: smws.id,
    name: "140.17 Bowled over by cinnamon cola",
    distillerIds: [source.id],
  });
  if (duplicateBottle.groupId === null) {
    throw new Error("Fixture Bottle must belong to a BottleGroup.");
  }
  await db
    .update(bottleGroupDistillers)
    .set({ distillerId: destination.id })
    .where(eq(bottleGroupDistillers.groupId, duplicateBottle.groupId));
  await db
    .update(entityAliases)
    .set({ entityId: destination.id })
    .where(eq(entityAliases.name, source.name));

  await mergeEntity({
    fromEntityIds: [source.id],
    toEntityId: destination.id,
  });

  expect(
    await db.query.entities.findFirst({ where: eq(entities.id, source.id) }),
  ).toBeUndefined();
  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, duplicateBottle.id),
    }),
  ).toBeUndefined();
  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, canonicalBottle.id),
    }),
  ).toMatchObject({ id: canonicalBottle.id });
  expect(
    await db.query.bottleTombstones.findFirst({
      where: eq(bottleTombstones.bottleId, duplicateBottle.id),
    }),
  ).toMatchObject({ newBottleId: canonicalBottle.id });
  expect(
    await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, source.name),
    }),
  ).toMatchObject({ entityId: destination.id });
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, source.id),
    }),
  ).toMatchObject({ newEntityId: destination.id });
});

test("preserves the source when the locked destination is deleted", async ({
  fixtures,
}) => {
  const source = await fixtures.Entity({
    name: "Missing Destination Source",
    type: ["brand"],
  });
  const destination = await fixtures.Entity({
    name: "Missing Destination Target",
  });
  const bottle = await fixtures.Bottle({ brandId: source.id });

  vi.mocked(pushUniqueJob).mockClear();
  await deleteDestinationWhileMergeWaits(destination.id, () =>
    mergeEntity({
      fromEntityIds: [source.id],
      toEntityId: destination.id,
    }),
  );

  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, source.id),
    }),
  ).toMatchObject({
    id: source.id,
    name: source.name,
    type: source.type,
  });
  expect(
    await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
  ).toMatchObject({ brandId: source.id });
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, source.id),
    }),
  ).toBeUndefined();
  expect(pushUniqueJob).not.toHaveBeenCalled();
});

test("stales an operation when its locked destination is deleted", async ({
  fixtures,
}) => {
  const source = await fixtures.Entity({
    name: "Deleted Operation Destination Source",
  });
  const destination = await fixtures.Entity({
    name: "Deleted Operation Destination Target",
  });
  const bottle = await fixtures.Bottle({ brandId: source.id });
  const moderator = await fixtures.User({ mod: true });
  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: source.id,
    destinationEntityId: destination.id,
  });

  vi.mocked(pushUniqueJob).mockClear();
  await deleteDestinationWhileMergeWaits(destination.id, () =>
    mergeEntity({
      operationId: operation.id,
      approvingModeratorId: moderator.id,
    }),
  );

  expect(
    await db.query.bottleOperations.findFirst({
      where: eq(bottleOperations.id, operation.id),
    }),
  ).toMatchObject({
    status: "stale",
    error: "Relevant catalog state changed before the Entity merge worker ran.",
  });
  expect(
    await db.query.entities.findFirst({ where: eq(entities.id, source.id) }),
  ).toMatchObject({ id: source.id, name: source.name, type: source.type });
  expect(
    await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
  ).toMatchObject({ brandId: source.id });
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, source.id),
    }),
  ).toBeUndefined();
  expect(pushUniqueJob).not.toHaveBeenCalled();
});

test("merge A from B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });

  await mergeEntity({
    fromEntityIds: [entityB.id],
    toEntityId: entityA.id,
  });

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeDefined();

  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeUndefined();

  const [tombstone] = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, entityB.id));
  expect(tombstone.newEntityId).toEqual(newEntityA.id);
});

test("preserves the disjoint Entity role union shown in the merge preview", async ({
  fixtures,
}) => {
  const source = await fixtures.Entity({
    name: "Role Union Source",
    type: ["distiller"],
  });
  const destination = await fixtures.Entity({
    name: "Role Union Destination",
    type: ["brand", "bottler"],
  });
  const proposal: MergeEntitiesOperation = {
    type: "merge_entities",
    input: {
      sourceEntityId: source.id,
      destinationEntityId: destination.id,
    },
    rationale: "Both inspected records identify the same producer.",
    evidenceRefs: [
      { kind: "entity", entityId: source.id },
      { kind: "entity", entityId: destination.id },
    ],
  };
  const prepared = await prepareOperation({
    operation: { id: 1, proposal },
    artifacts: {
      resolvedEntities: [
        { entityId: source.id, name: source.name },
        { entityId: destination.id, name: destination.name },
      ],
      entityContexts: [source, destination].map((entity) => ({
        entityId: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        roles: entity.type,
        website: entity.website,
        country: null,
        region: null,
        yearEstablished: entity.yearEstablished,
        aliases: [],
        relatedBottles: [],
      })),
    },
  });
  expect(prepared.status).toBe("pending_review");
  if (
    prepared.status !== "pending_review" ||
    prepared.type !== "merge_entities"
  ) {
    throw new Error("Expected the Entity merge preview to be prepared.");
  }

  await mergeEntity({
    fromEntityIds: [source.id],
    toEntityId: destination.id,
  });

  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, destination.id),
    }),
  ).toMatchObject({
    type: prepared.preview.after.roles,
  });
});

test("merge duplicate bottle", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const bottleA = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Duplicate",
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });
  const bottleB = await fixtures.Bottle({
    brandId: entityB.id,
    name: "Duplicate",
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeUndefined();

  const [newBottleB] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleB.id));
  expect(newBottleB).toBeDefined();
  expect(newBottleB.name).toEqual("Duplicate");
});

test("preflights exact batch duplicates from BottleGroup authority", async ({
  defaults,
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({ name: "Batch Source" });
  const destinationEntity = await fixtures.Entity({
    name: "Batch Destination",
  });
  const source = await fixtures.Bottle({
    brandId: sourceEntity.id,
    name: "Annual",
  });
  const sourceGroupId = requireGroupId(source.groupId);
  const sourceBatch = await fixtures.BottleGroupMember({
    groupId: sourceGroupId,
    edition: "Batch 2",
  });
  const destinationBatch = await createBottle({
    context: contextFor(defaults.user),
    input: {
      brand: destinationEntity.id,
      name: "Annual",
      edition: "Batch 2",
    },
  });
  await db
    .update(bottles)
    .set({ name: "Drifted Member", fullName: "Batch Source Drifted Member" })
    .where(eq(bottles.id, sourceBatch.id));

  await mergeEntity({
    fromEntityIds: [sourceEntity.id],
    toEntityId: destinationEntity.id,
  });

  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, sourceBatch.id),
    }),
  ).toBeUndefined();
  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, destinationBatch.bottle.id),
    }),
  ).toMatchObject({ fullName: "Batch Destination Annual - Batch 2" });
  expect(
    await db.query.bottles.findFirst({ where: eq(bottles.id, source.id) }),
  ).toMatchObject({
    brandId: destinationEntity.id,
    fullName: "Batch Destination Annual",
  });
});

test("fans merged shared entity roles through every BottleGroup member", async ({
  defaults,
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({
    name: "Shared Source",
    type: ["brand", "bottler", "distiller"],
  });
  const destinationEntity = await fixtures.Entity({
    name: "Shared Destination",
    type: ["brand", "bottler", "distiller"],
  });
  const sourceSeries = await fixtures.BottleSeries({
    brandId: sourceEntity.id,
    name: "Range",
  });
  const first = await fixtures.Bottle({
    brandId: sourceEntity.id,
    bottlerId: sourceEntity.id,
    distillerIds: [sourceEntity.id],
    name: "Expression",
    seriesId: sourceSeries.id,
  });
  const firstGroupId = requireGroupId(first.groupId);
  const second = await fixtures.BottleGroupMember({
    groupId: firstGroupId,
    edition: "Batch 2",
  });

  await mergeEntity({
    fromEntityIds: [sourceEntity.id],
    toEntityId: destinationEntity.id,
  });

  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, firstGroupId),
    }),
  ).toMatchObject({
    brandId: destinationEntity.id,
    bottlerId: destinationEntity.id,
    fullName: "Shared Destination Expression",
  });
  const members = await db.query.bottles.findMany({
    where: eq(bottles.groupId, first.groupId!),
    orderBy: (table, { asc }) => [asc(table.id)],
  });
  expect(members).toHaveLength(2);
  expect(members).toEqual([
    expect.objectContaining({
      id: first.id,
      brandId: destinationEntity.id,
      bottlerId: destinationEntity.id,
      fullName: "Shared Destination Expression",
    }),
    expect.objectContaining({
      id: second.id,
      brandId: destinationEntity.id,
      bottlerId: destinationEntity.id,
      fullName: "Shared Destination Expression - Batch 2",
    }),
  ]);
  expect(
    await db
      .select()
      .from(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, first.groupId!)),
  ).toEqual([{ groupId: first.groupId, distillerId: destinationEntity.id }]);
  expect(
    await db.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, sourceSeries.id),
    }),
  ).toBeUndefined();
  const targetSeries = await db.query.bottleSeries.findFirst({
    where: and(
      eq(bottleSeries.brandId, destinationEntity.id),
      eq(bottleSeries.name, sourceSeries.name),
    ),
  });
  expect(targetSeries).toMatchObject({
    fullName: "Shared Destination Range",
    numReleases: 2,
  });
  expect(members.map(({ seriesId }) => seriesId)).toEqual([
    targetSeries!.id,
    targetSeries!.id,
  ]);
  expect(
    await db.query.changes.findFirst({
      where: and(
        eq(changes.objectType, "bottle"),
        eq(changes.objectId, first.id),
        eq(changes.type, "update"),
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
  ).toMatchObject({
    data: expect.objectContaining({ creationSource: "repair_workflow" }),
  });
});
test("operation-backed merge records applied only after canonical state and attributes catalog changes to the moderator", async ({
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({
    name: "Operation Source",
    type: ["distiller"],
  });
  const destinationEntity = await fixtures.Entity({
    name: "Operation Destination",
    type: ["brand"],
  });
  const bottle = await fixtures.Bottle({
    distillerIds: [sourceEntity.id],
    name: "Core",
  });
  const moderator = await fixtures.User({
    mod: true,
    username: "merge-approver",
  });
  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
  });

  await mergeEntity({
    operationId: operation.id,
    approvingModeratorId: moderator.id,
  });

  const completed = await db.query.bottleOperations.findFirst({
    where: eq(bottleOperations.id, operation.id),
  });
  expect(completed).toMatchObject({
    status: "applied",
    error: null,
    result: {
      type: "merge_entities",
      sourceEntityId: sourceEntity.id,
      destinationEntityId: destinationEntity.id,
      destinationRoles: ["brand", "distiller"],
      approvingModeratorId: moderator.id,
      reconciled: false,
      execution: {
        kind: "worker",
        name: "MergeEntity",
      },
    },
  });
  expect(completed?.executionCompletedAt).toBeInstanceOf(Date);
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, sourceEntity.id),
    }),
  ).toMatchObject({ newEntityId: destinationEntity.id });

  const entityChange = await db.query.changes.findFirst({
    where: and(
      eq(changes.objectType, "entity"),
      eq(changes.objectId, sourceEntity.id),
      eq(changes.type, "delete"),
    ),
  });
  expect(entityChange?.data).toMatchObject({
    operationId: operation.id,
    execution: { kind: "worker", name: "MergeEntity" },
  });
  const actor = await db.query.actors.findFirst({
    where: eq(actors.id, entityChange!.actorId),
  });
  expect(actor).toMatchObject({
    type: "user",
    userId: moderator.id,
  });
  const destinationChange = await db.query.changes.findFirst({
    where: and(
      eq(changes.objectType, "entity"),
      eq(changes.objectId, destinationEntity.id),
      eq(changes.type, "update"),
    ),
  });
  expect(destinationChange?.data).toMatchObject({
    operationId: operation.id,
    destinationRoles: ["brand", "distiller"],
    roleChange: {
      before: ["brand"],
      after: ["brand", "distiller"],
    },
  });

  const bottleChange = await db.query.changes.findFirst({
    where: and(
      eq(changes.objectType, "bottle"),
      eq(changes.objectId, bottle.id),
      eq(changes.type, "update"),
    ),
    orderBy: (table, { desc }) => [desc(table.id)],
  });
  expect(bottleChange?.actorId).toBe(actor?.id);
});

test("operation-backed merge becomes stale when relevant state drifts before the worker runs", async ({
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({ name: "Failure Source" });
  const destinationEntity = await fixtures.Entity({
    name: "Drifted Destination",
  });
  const bottle = await fixtures.Bottle({ brandId: sourceEntity.id });
  const moderator = await fixtures.User({ mod: true });
  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
  });
  await db
    .update(entities)
    .set({ name: "Drifted Destination Renamed" })
    .where(eq(entities.id, destinationEntity.id));

  await mergeEntity({
    operationId: operation.id,
    approvingModeratorId: moderator.id,
  });

  expect(
    await db.query.bottleOperations.findFirst({
      where: eq(bottleOperations.id, operation.id),
    }),
  ).toMatchObject({
    status: "stale",
    error: "Relevant catalog state changed before the Entity merge worker ran.",
  });
  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, sourceEntity.id),
    }),
  ).toMatchObject({ id: sourceEntity.id });
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, sourceEntity.id),
    }),
  ).toBeUndefined();
});

test("operation-backed merge does not mutate after its primary attempt is deleted", async ({
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({ name: "Deleted Gate Source" });
  const destinationEntity = await fixtures.Entity({
    name: "Deleted Gate Destination",
  });
  const bottle = await fixtures.Bottle({ brandId: sourceEntity.id });
  const price = await fixtures.StorePrice({
    bottleId: null,
    name: "Deleted Gate Listing",
  });
  const moderator = await fixtures.User({ mod: true });
  const [primaryProposal] = await db
    .insert(storePriceMatchProposals)
    .values({
      priceId: price.id,
      proposalType: "no_match",
      status: "ignored",
    })
    .returning();
  const [primaryAttempt] = await db
    .insert(storePriceMatchAttempts)
    .values({
      priceId: price.id,
      proposalId: primaryProposal!.id,
      proposalType: "no_match",
      initialStatus: "pending_review",
      finalStatus: "ignored",
    })
    .returning();
  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
    storePrice: {
      attemptId: primaryAttempt!.id,
      priceId: price.id,
      priceName: price.name,
    },
  });

  await db
    .delete(storePriceMatchProposals)
    .where(eq(storePriceMatchProposals.id, primaryProposal!.id));

  await mergeEntity({
    operationId: operation.id,
    approvingModeratorId: moderator.id,
  });

  expect(
    await db.query.bottleOperations.findFirst({
      where: eq(bottleOperations.id, operation.id),
    }),
  ).toMatchObject({
    status: "stale",
    error: "The linked primary store-price decision is no longer complete.",
  });
  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, sourceEntity.id),
    }),
  ).toMatchObject({ id: sourceEntity.id });
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, sourceEntity.id),
    }),
  ).toBeUndefined();
});

test("operation-backed retry reconciles an already-applied merge without mutating twice", async ({
  fixtures,
}) => {
  const sourceEntity = await fixtures.Entity({
    name: "Reconcile Source",
    type: ["brand", "distiller"],
  });
  const destinationEntity = await fixtures.Entity({
    name: "Reconcile Destination",
    type: ["bottler"],
  });
  const bottle = await fixtures.Bottle({ brandId: sourceEntity.id });
  const moderator = await fixtures.User({ mod: true });

  const operation = await createApplyingEntityMergeOperation({
    approvingModeratorId: moderator.id,
    bottleId: bottle.id,
    sourceEntityId: sourceEntity.id,
    destinationEntityId: destinationEntity.id,
  });
  await mergeEntity({
    fromEntityIds: [sourceEntity.id],
    toEntityId: destinationEntity.id,
  });
  const tombstonesBefore = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, sourceEntity.id));

  await mergeEntity({
    operationId: operation.id,
    approvingModeratorId: moderator.id,
  });
  await mergeEntity({
    operationId: operation.id,
    approvingModeratorId: moderator.id,
  });

  expect(
    await db.query.bottleOperations.findFirst({
      where: eq(bottleOperations.id, operation.id),
    }),
  ).toMatchObject({
    status: "applied",
    result: {
      sourceEntityId: sourceEntity.id,
      destinationEntityId: destinationEntity.id,
      destinationRoles: ["bottler", "brand", "distiller"],
      reconciled: true,
    },
  });
  expect(
    await db.query.entities.findFirst({
      where: eq(entities.id, destinationEntity.id),
    }),
  ).toMatchObject({
    type: ["bottler", "brand", "distiller"],
  });
  expect(
    await db
      .select()
      .from(entityTombstones)
      .where(eq(entityTombstones.entityId, sourceEntity.id)),
  ).toEqual(tombstonesBefore);
});
