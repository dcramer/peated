import { db } from "@peated/server/db";
import { bottles, bottleTombstones } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import mergeBottle from "./mergeBottle";

test("merge A into B", async ({ fixtures }) => {
  const bottleA = await fixtures.Bottle({ totalTastings: 1 });
  await fixtures.Tasting({ bottleId: bottleA.id });
  const bottleB = await fixtures.Bottle();

  await mergeBottle({
    fromBottleIds: [bottleA.id],
    toBottleId: bottleB.id,
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

  await mergeBottle({
    fromBottleIds: [bottleB.id],
    toBottleId: bottleA.id,
  });

  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeDefined();

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
