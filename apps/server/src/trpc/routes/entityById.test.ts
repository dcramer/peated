import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("get entity by id", async () => {
  const brand = await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.entityById(brand.id);
  expect(data.id).toEqual(brand.id);
});

test("errors on invalid entity", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.entityById(1)).rejects.toThrowError(/NOT_FOUND/);
});

test("gets entity with tombstone", async () => {
  const entity1 = await Fixtures.Entity();
  await db.insert(entityTombstones).values({
    entityId: 999,
    newEntityId: entity1.id,
  });
  await Fixtures.Bottle();

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.entityById(999);
  expect(data.id).toEqual(entity1.id);
});
