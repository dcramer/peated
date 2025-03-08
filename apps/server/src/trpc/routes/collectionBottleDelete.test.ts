import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
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
});

test("delete bottle with edition", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const edition = await fixtures.BottleEdition({ bottleId: bottle.id });
  const collection = await fixtures.Collection({
    createdById: defaults.user.id,
  });
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
    editionId: edition.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleDelete({
    user: "me",
    collection: collection.id,
    bottle: bottle.id,
    edition: edition.id,
  });

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(
      and(
        eq(collectionBottles.bottleId, bottle.id),
        eq(collectionBottles.editionId, edition.id),
      ),
    );

  expect(bottleList.length).toBe(0);
});

test("only deletes specific edition", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();
  const edition1 = await fixtures.BottleEdition({ bottleId: bottle.id });
  const edition2 = await fixtures.BottleEdition({ bottleId: bottle.id });
  const collection = await fixtures.Collection({
    name: "default",
    createdById: defaults.user.id,
  });

  // Add both editions to collection
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
    editionId: edition1.id,
  });
  await db.insert(collectionBottles).values({
    bottleId: bottle.id,
    collectionId: collection.id,
    editionId: edition2.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleDelete({
    user: "me",
    collection: "default",
    bottle: bottle.id,
    edition: edition1.id,
  });

  // Should only delete edition1, leaving edition2
  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(1);
  expect(bottleList[0].editionId).toBe(edition2.id);
});
