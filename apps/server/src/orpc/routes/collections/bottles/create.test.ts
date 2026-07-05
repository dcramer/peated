import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  collectionBottles,
  collections,
  pendingUploads,
} from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";

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

  test("saves a pending image when adding a bottle to library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/uploads/bottles/canonical.webp",
    });
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.imageUrl).toContain("/uploads/collection-bottles/");

    const [[collectionBottle], canonicalBottle] = await Promise.all([
      db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.id, result.id)),
      db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ]);

    expect(collectionBottle.imageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-\d+-pending-upload-.+\.webp$/,
    );
    expect(canonicalBottle?.imageUrl).toBe("/uploads/bottles/canonical.webp");
  });

  test("saves a pending image when adding a release to library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/uploads/bottles/canonical.webp",
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      imageUrl: "/uploads/bottle-releases/canonical-release.webp",
    });
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        release: release.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.release?.id).toBe(release.id);
    expect(result.imageUrl).toContain("/uploads/collection-bottles/");

    const [[collectionBottle], canonicalBottle, canonicalRelease] =
      await Promise.all([
        db
          .select()
          .from(collectionBottles)
          .where(eq(collectionBottles.id, result.id)),
        db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
        db.query.bottleReleases.findFirst({
          where: eq(bottleReleases.id, release.id),
        }),
      ]);

    expect(collectionBottle.releaseId).toBe(release.id);
    expect(collectionBottle.imageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-\d+-pending-upload-.+\.webp$/,
    );
    expect(canonicalBottle?.imageUrl).toBe("/uploads/bottles/canonical.webp");
    expect(canonicalRelease?.imageUrl).toBe(
      "/uploads/bottle-releases/canonical-release.webp",
    );
  });

  test("updates an existing library entry image only when pending image is supplied", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const firstPendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    const secondPendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const first = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: firstPendingUpload.id,
      },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: secondPendingUpload.id,
      },
      { context: { user: defaults.user } },
    );
    const third = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(second.id).toBe(first.id);
    expect(second.imageUrl).not.toBe(first.imageUrl);
    expect(third.id).toBe(first.id);
    expect(third.imageUrl).toBe(second.imageUrl);

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(1);
  });

  test("rejects collection images outside Library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection images are only supported for Library entries.]`,
    );

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(0);
  });

  test("rejects expired pending image before adding to library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      ttlMs: -1000,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "library",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Pending upload has expired.]`);

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(0);
  });

  test("fails and rolls back new library entry when image copy fails after validation", async ({
    fixtures,
    defaults,
  }) => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    await db
      .update(pendingUploads)
      .set({ imageUrl: "/uploads/pending-uploads/missing-source.webp" })
      .where(eq(pendingUploads.id, pendingUpload.id));

    try {
      const err = await waitError(() =>
        routerClient.collections.bottles.create(
          {
            user: "me",
            collection: "library",
            bottle: bottle.id,
            pendingImageId: pendingUpload.id,
          },
          { context: { user: defaults.user } },
        ),
      );

      expect(err).toMatchObject({ code: "ENOENT" });
      expect(consoleError).toHaveBeenCalled();

      const rows = await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.bottleId, bottle.id));
      expect(rows).toHaveLength(0);

      const libraryCollection = await db.query.collections.findFirst({
        where: (collections, { and, eq }) =>
          and(
            eq(collections.createdById, defaults.user.id),
            eq(collections.name, "Library"),
          ),
      });
      expect(libraryCollection?.totalBottles).toBe(0);
    } finally {
      consoleError.mockRestore();
    }
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
