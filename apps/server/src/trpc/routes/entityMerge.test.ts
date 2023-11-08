import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.entityMerge({
      root: 1,
      other: 2,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("requires mod", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.entityMerge({
      root: 1,
      other: 2,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("merge A into B", async () => {
  const entityA = await Fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await Fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
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
});

test("merge A from B", async () => {
  const entityA = await Fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await Fixtures.Entity({ totalTastings: 3, totalBottles: 1 });

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
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
});
