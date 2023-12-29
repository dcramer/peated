import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("gets bottle", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.bottleById(bottle1.id);
  expect(data.id).toEqual(bottle1.id);
});

test("errors on invalid bottle", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.bottleById(1)).rejects.toThrowError(/Bottle not found/);
});

test("gets bottle with tombstone", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await db.insert(bottleTombstones).values({
    bottleId: 999,
    newBottleId: bottle1.id,
  });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const data = await caller.bottleById(999);
  expect(data.id).toEqual(bottle1.id);
});
