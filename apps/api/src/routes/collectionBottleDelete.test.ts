import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "@peated/server/trpc/router";
import { and, eq } from "drizzle-orm";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(
    caller.collectionBottleDelete({
      user: "me",
      collection: "default",
      bottle: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("delete bottle from default", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const collection = await fixtures.Collection({
    createdById: defaults.user.id,
    totalBottles: 1,
  });
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleDelete({
    user: "me",
    collection: collection.id,
    bottle: bottle.id,
  });

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(0);

  // Verify totalBottles was decremented
  const [updatedCollection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collection.id));
  expect(updatedCollection.totalBottles).toBe(0);
});

test("delete bottle with release", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const release = await fixtures.BottleRelease({ bottleId: bottle.id });
  const collection = await fixtures.Collection({
    createdById: defaults.user.id,
    totalBottles: 1,
  });
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
    releaseId: release.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleDelete({
    user: "me",
    collection: collection.id,
    bottle: bottle.id,
    release: release.id,
  });

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(
      and(
        eq(collectionBottles.bottleId, bottle.id),
        eq(collectionBottles.releaseId, release.id),
      ),
    );

  expect(bottleList.length).toBe(0);

  // Verify totalBottles was decremented
  const [updatedCollection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collection.id));
  expect(updatedCollection.totalBottles).toBe(0);
});

test("only deletes specific release", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const release1 = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "A",
  });
  const release2 = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "B",
  });
  const collection = await fixtures.Collection({
    name: "default",
    createdById: defaults.user.id,
    totalBottles: 1,
  });

  // Add both releases to collection
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
    releaseId: release1.id,
  });
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
    releaseId: release2.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleDelete({
    user: "me",
    collection: "default",
    bottle: bottle.id,
    release: release1.id,
  });

  // Should only delete release1, leaving release2
  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(1);
  expect(bottleList[0].releaseId).toBe(release2.id);

  // Verify totalBottles was decremented by 1 even though we still have one release
  const [updatedCollection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collection.id));
  expect(updatedCollection.totalBottles).toBe(0);
});

test("deleting non-existent bottle from collection", async ({
  fixtures,
  defaults,
}) => {
  const bottle = await fixtures.Bottle();
  const collection = await fixtures.Collection({
    createdById: defaults.user.id,
    totalBottles: 1,
  });

  const caller = createCaller({
    user: defaults.user,
  });

  // Attempt to delete a bottle that isn't in the collection
  await caller.collectionBottleDelete({
    user: "me",
    collection: collection.id,
    bottle: bottle.id,
  });

  // Verify totalBottles hasn't changed
  const [updatedCollection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collection.id));
  expect(updatedCollection.totalBottles).toBe(1);

  // Verify no bottles were deleted (though there weren't any to begin with)
  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));
  expect(bottleList.length).toBe(0);
});
