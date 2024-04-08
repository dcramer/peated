import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import { createCaller } from "../router";

test("gets bottle", async ({ fixtures }) => {
  const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
  await fixtures.Bottle({ name: "Something Else" });

  const caller = createCaller({ user: null });
  const data = await caller.bottleById(bottle1.id);
  expect(data.id).toEqual(bottle1.id);
});

test("errors on invalid bottle", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.bottleById(1)).rejects.toThrowError(/Bottle not found/);
});

test("gets bottle with tombstone", async ({ fixtures }) => {
  const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
  await db.insert(bottleTombstones).values({
    bottleId: 999,
    newBottleId: bottle1.id,
  });
  await fixtures.Bottle({ name: "Something Else" });

  const caller = createCaller({ user: null });
  const data = await caller.bottleById(999);
  expect(data.id).toEqual(bottle1.id);
});
