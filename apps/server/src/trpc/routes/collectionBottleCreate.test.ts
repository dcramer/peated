import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  expect(() =>
    caller.collectionBottleCreate({
      user: "me",
      collection: "default",
      bottle: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("new bottle in default", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.collectionBottleCreate({
    user: "me",
    collection: "default",
    bottle: bottle.id,
  });

  expect(data.id).toBeDefined();
  expect(data.comment).toBe("Hello world!");

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(1);
});
