import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /users/:user/collections/:collection/bottles", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collections.bottles.create({
        user: "me",
        collection: "default",
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("adds bottle to default collection", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
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

  test("adds bottle to library collection", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const libraryCollection = await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Library"),
        ),
    });
    if (!libraryCollection) {
      throw new Error("Library collection not found");
    }

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].collectionId).toBe(libraryCollection.id);
  });

  test("uses legacy non-library collection for default alias", async ({
    fixtures,
    defaults,
  }) => {
    const legacyCollection = await fixtures.Collection({
      name: "Personal Favorites",
      createdById: defaults.user.id,
    });
    await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
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
    const defaultCollection = await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Default"),
        ),
    });

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].collectionId).toBe(legacyCollection.id);
    expect(defaultCollection).toBeUndefined();
  });

  test("adds multiple bottles without releases to default collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle1 = await fixtures.Bottle();
    const bottle2 = await fixtures.Bottle();

    // Add first bottle
    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle1.id,
      },
      { context: { user: defaults.user } },
    );

    // Add second bottle
    await routerClient.collections.bottles.create(
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

    await routerClient.collections.bottles.create(
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

  test("adds bottle with release to library collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].releaseId).toBe(release.id);
  });

  test("allows saving the base bottle and a specific release separately", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    await routerClient.collections.bottles.create(
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

    expect(bottleList).toHaveLength(2);
    expect(bottleList.some((item) => item.releaseId === null)).toBeTruthy();
    expect(
      bottleList.some((item) => item.releaseId === release.id),
    ).toBeTruthy();
  });

  test("fails with invalid release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: otherBottle.id });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          release: release.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify release.]`);
  });

  test("fails with nonexistent release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          release: 12345,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify release.]`);
  });

  test("fails with nonexistent bottle", async ({ fixtures, defaults }) => {
    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: 99999,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot find bottle.]`);
  });

  test("prevents modifying another user's collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();
    const collection = await fixtures.Collection({ createdById: otherUser.id });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });

  test("prevents modifying another user's library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: otherUser.id,
          collection: "library",
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });

  test("resolves default and library by reserved name", async ({
    fixtures,
    defaults,
  }) => {
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const defaultCollection = await fixtures.Collection({
      name: "Default",
      createdById: defaults.user.id,
    });
    const favoriteBottle = await fixtures.Bottle();
    const libraryBottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: favoriteBottle.id,
      },
      { context: { user: defaults.user } },
    );
    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: libraryBottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db.select().from(collectionBottles);

    expect(
      bottleList.find((item) => item.bottleId === favoriteBottle.id)
        ?.collectionId,
    ).toBe(defaultCollection.id);
    expect(
      bottleList.find((item) => item.bottleId === libraryBottle.id)
        ?.collectionId,
    ).toBe(libraryCollection.id);
  });
});
