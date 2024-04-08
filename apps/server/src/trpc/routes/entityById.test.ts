import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("get entity by id", async ({ fixtures }) => {
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: null });
  const data = await caller.entityById(brand.id);
  expect(data.id).toEqual(brand.id);
});

test("errors on invalid entity", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.entityById(1));
  expect(err).toMatchInlineSnapshot();
});

test("gets entity with tombstone", async ({ fixtures }) => {
  const entity1 = await fixtures.Entity();
  await db.insert(entityTombstones).values({
    entityId: 999,
    newEntityId: entity1.id,
  });
  await fixtures.Bottle();

  const caller = createCaller({ user: null });
  const data = await caller.entityById(999);
  expect(data.id).toEqual(entity1.id);
});
