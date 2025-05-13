import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(
    caller.collectionBottleCreate({
      user: "me",
      collection: "default",
      bottle: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("new bottle in default", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleCreate({
    user: "me",
    collection: "default",
    bottle: bottle.id,
  });

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(1);
});

test("multiple bottles without releases in default", async ({
  fixtures,
  defaults,
}) => {
  const bottle1 = await fixtures.Bottle();
  const bottle2 = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });

  // Add first bottle
  await caller.collectionBottleCreate({
    user: "me",
    collection: "default",
    bottle: bottle1.id,
  });

  // Add second bottle
  await caller.collectionBottleCreate({
    user: "me",
    collection: "default",
    bottle: bottle2.id,
  });

  // Get the actual default collection that was used
  const defaultCollection = await getDefaultCollection(db, defaults.user.id);
  if (!defaultCollection) {
    throw new Error("Default collection not found");
  }

  // Check both bottles are in the collection
  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.collectionId, defaultCollection.id));

  expect(bottleList.length).toBe(2);
  expect(bottleList.map((b) => b.bottleId).sort()).toEqual(
    [bottle1.id, bottle2.id].sort(),
  );
  expect(bottleList.every((b) => b.releaseId === null)).toBe(true);
});

test("new bottle with release in default", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const release = await fixtures.BottleRelease({ bottleId: bottle.id });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleCreate({
    user: "me",
    collection: "default",
    bottle: bottle.id,
    release: release.id,
  });

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(1);
  expect(bottleList[0].releaseId).toBe(release.id);
});

test("fails with invalid release", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const otherBottle = await fixtures.Bottle();
  const release = await fixtures.BottleRelease({ bottleId: otherBottle.id });

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(
    caller.collectionBottleCreate({
      user: "me",
      collection: "default",
      bottle: bottle.id,
      release: release.id,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Cannot identify release.]`);
});

test("fails with nonexistent release", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(
    caller.collectionBottleCreate({
      user: "me",
      collection: "default",
      bottle: bottle.id,
      release: 12345,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Cannot identify release.]`);
});
