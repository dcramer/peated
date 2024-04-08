import { db } from "@peated/server/db";
import { entities, entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.entityMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot();
});

test("requires mod", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.entityMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot();
});

test("merge A into B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityMerge({
    root: entityA.id,
    other: entityB.id,
    direction: "mergeInto",
  });

  expect(data.id).toEqual(entityB.id);

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
  expect(newEntityB.totalTastings).toEqual(4);
  expect(newEntityB.totalBottles).toEqual(3);

  const [tombstone] = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, entityA.id));
  expect(tombstone.newEntityId).toEqual(newEntityB.id);
});

test("merge A from B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityMerge({
    root: entityA.id,
    other: entityB.id,
    direction: "mergeFrom",
  });

  expect(data.id).toEqual(entityA.id);

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeDefined();
  expect(newEntityA.totalTastings).toEqual(4);
  expect(newEntityA.totalBottles).toEqual(3);

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
