import { db } from "@peated/server/db";
import { bottles, entities, entityTombstones } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import mergeEntity from "./mergeEntity";

test("merge A into B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

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
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

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
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const bottleA = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Duplicate",
  });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });
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

test("merge unique bottle", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const bottleA = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Unique",
  });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });
  const bottleB = await fixtures.Bottle({
    brandId: entityB.id,
    name: "More Unique",
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeDefined();
  expect(newBottleA.brandId).toEqual(entityB.id);
  expect(newBottleA.name).toEqual("Unique");

  const [newBottleB] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleB.id));
  expect(newBottleB).toBeDefined();
  expect(newBottleB.brandId).toEqual(entityB.id);
  expect(newBottleB.name).toEqual("More Unique");
});
