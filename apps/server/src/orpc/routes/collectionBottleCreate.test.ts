import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("POST /users/:user/collections/:collection/bottles", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collectionBottleCreate({
        user: "me",
        collection: "default",
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: UNAUTHORIZED: Authentication required]
    `);
  });

  test("adds bottle to default collection", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    await routerClient.collectionBottleCreate(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList.length).toBe(1);
  });

  test("adds multiple bottles without releases to default collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle1 = await fixtures.Bottle();
    const bottle2 = await fixtures.Bottle();

    // Add first bottle
    await routerClient.collectionBottleCreate(
      {
        user: "me",
        collection: "default",
        bottle: bottle1.id,
      },
      { context: { user: defaults.user } },
    );

    // Add second bottle
    await routerClient.collectionBottleCreate(
      {
        user: "me",
        collection: "default",
        bottle: bottle2.id,
      },
      { context: { user: defaults.user } },
    );

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

  test("adds bottle with release to default collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });

    await routerClient.collectionBottleCreate(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

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

    const err = await waitError(() =>
      routerClient.collectionBottleCreate(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          release: release.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: BAD_REQUEST: Cannot identify release.]
    `);
  });

  test("fails with nonexistent release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(() =>
      routerClient.collectionBottleCreate(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          release: 12345,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: BAD_REQUEST: Cannot identify release.]
    `);
  });

  test("fails with nonexistent bottle", async ({ fixtures, defaults }) => {
    const err = await waitError(() =>
      routerClient.collectionBottleCreate(
        {
          user: "me",
          collection: "default",
          bottle: 99999,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: NOT_FOUND: Cannot find bottle.]
    `);
  });

  test("prevents modifying another user's collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();
    const collection = await fixtures.Collection({ createdById: otherUser.id });

    const err = await waitError(() =>
      routerClient.collectionBottleCreate(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: NOT_FOUND: Collection not found.]
    `);
  });
});
