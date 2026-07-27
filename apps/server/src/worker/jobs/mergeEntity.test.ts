import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottleReleases,
  bottles,
  bottleSeries,
  changes,
  entities,
  entityTombstones,
} from "@peated/server/db/schema";
import type { getUserActor } from "@peated/server/lib/actors";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, expect } from "vitest";
import mergeEntity from "./mergeEntity";

function contextFor(user: Parameters<typeof getUserActor>[0]) {
  return { user } as Parameters<typeof createConcreteBottle>[0]["context"];
}

beforeEach(async ({ fixtures }) => {
  await fixtures.User({ admin: true, username: "dcramer" });
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
  expect(
    await db
      .select()
      .from(bottleGroupTombstones)
      .where(eq(bottleGroupTombstones.groupId, bottleA.groupId!)),
  ).toEqual([expect.objectContaining({ newGroupId: bottleB.groupId })]);
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
  const sourceBatch = await fixtures.BottleGroupMember({
    groupId: source.groupId as number,
    edition: "Batch 2",
  });
  const destinationBatch = await createConcreteBottle({
    context: contextFor(defaults.user),
    input: {
      stable: { brand: destinationEntity.id, name: "Annual" },
      exact: { edition: "Batch 2" },
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
  const second = await fixtures.BottleGroupMember({
    groupId: first.groupId as number,
    edition: "Batch 2",
  });

  await mergeEntity({
    fromEntityIds: [sourceEntity.id],
    toEntityId: destinationEntity.id,
  });

  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, first.groupId!),
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

async function expectReleaseOwnedDuplicateRollback(
  fixtures: typeof Fixtures,
  releaseOwner: "source" | "destination",
) {
  const sourceEntity = await fixtures.Entity({ name: "Release Source" });
  const destinationEntity = await fixtures.Entity({
    name: "Release Destination",
  });
  const sourceBottle = await fixtures.Bottle({
    brandId: sourceEntity.id,
    name: "Duplicate",
  });
  const destinationBottle = await fixtures.Bottle({
    brandId: destinationEntity.id,
    name: "Duplicate",
  });
  const release = await fixtures.BottleRelease({
    bottleId:
      releaseOwner === "source" ? sourceBottle.id : destinationBottle.id,
    edition: `${releaseOwner} child`,
  });
  const entityIds = [sourceEntity.id, destinationEntity.id];
  const bottleIds = [sourceBottle.id, destinationBottle.id];
  const entitiesBefore = await db
    .select()
    .from(entities)
    .where(inArray(entities.id, entityIds))
    .orderBy(asc(entities.id));
  const bottlesBefore = await db
    .select()
    .from(bottles)
    .where(inArray(bottles.id, bottleIds))
    .orderBy(asc(bottles.id));
  const aliasesBefore = await db
    .select()
    .from(bottleAliases)
    .where(inArray(bottleAliases.bottleId, bottleIds))
    .orderBy(asc(bottleAliases.name));
  const releaseBefore = await db.query.bottleReleases.findFirst({
    where: eq(bottleReleases.id, release.id),
  });

  await expect(
    mergeEntity({
      fromEntityIds: [sourceEntity.id],
      toEntityId: destinationEntity.id,
    }),
  ).rejects.toMatchObject({ code: "unmigrated" });

  expect(
    await db
      .select()
      .from(entities)
      .where(inArray(entities.id, entityIds))
      .orderBy(asc(entities.id)),
  ).toEqual(entitiesBefore);
  expect(
    await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, bottleIds))
      .orderBy(asc(bottles.id)),
  ).toEqual(bottlesBefore);
  expect(
    await db
      .select()
      .from(bottleAliases)
      .where(inArray(bottleAliases.bottleId, bottleIds))
      .orderBy(asc(bottleAliases.name)),
  ).toEqual(aliasesBefore);
  expect(
    await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, release.id),
    }),
  ).toEqual(releaseBefore);
  expect(
    await db.query.entityTombstones.findFirst({
      where: eq(entityTombstones.entityId, sourceEntity.id),
    }),
  ).toBeUndefined();
}

test("rolls back duplicate merges when the source Bottle owns releases", async ({
  fixtures,
}) => {
  await expectReleaseOwnedDuplicateRollback(fixtures, "source");
});

test("rolls back duplicate merges when the destination Bottle owns releases", async ({
  fixtures,
}) => {
  await expectReleaseOwnedDuplicateRollback(fixtures, "destination");
});
