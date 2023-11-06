import { db } from "@peated/server/db";
import { eq } from "drizzle-orm";
import { stores } from "../../db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires admin", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.storeCreate({ type: "totalwines", name: "Total Wines" }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("creates a new store", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const data = await caller.storeCreate({
    type: "totalwines",
    name: "Total Wines",
  });

  expect(data.id).toBeDefined();

  const [store] = await db.select().from(stores).where(eq(stores.id, data.id));
  expect(store.name).toEqual("Total Wines");
  expect(store.type).toEqual("totalwines");
  expect(store.lastRunAt).toBeNull();
  expect(store.country).toBeNull();
});
