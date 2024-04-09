import { db } from "@peated/server/db";
import { bottleTombstones, bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.bottleMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ mod: false, admin: false }),
  });
  const err = await waitError(
    caller.bottleMerge({
      root: 1,
      other: 2,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("merge A into B", async ({ fixtures }) => {
  const bottleA = await fixtures.Bottle({ totalTastings: 1 });
  await fixtures.Tasting({ bottleId: bottleA.id });
  const bottleB = await fixtures.Bottle();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleMerge({
    root: bottleA.id,
    other: bottleB.id,
    direction: "mergeInto",
  });

  expect(data.id).toEqual(bottleB.id);

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
  expect(newBottleB.totalTastings).toEqual(1);

  const [tombstone] = await db
    .select()
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleA.id));
  expect(tombstone.newBottleId).toEqual(newBottleB.id);
});

test("merge A from B", async ({ fixtures }) => {
  const bottleA = await fixtures.Bottle({ totalTastings: 1 });
  await fixtures.Tasting({ bottleId: bottleA.id });
  const bottleB = await fixtures.Bottle();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleMerge({
    root: bottleA.id,
    other: bottleB.id,
    direction: "mergeFrom",
  });

  expect(data.id).toEqual(bottleA.id);

  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeDefined();
  expect(newBottleA.totalTastings).toEqual(1);

  const [newBottleB] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleB.id));
  expect(newBottleB).toBeUndefined();

  const [tombstone] = await db
    .select()
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleB.id));
  expect(tombstone.newBottleId).toEqual(newBottleA.id);
});
