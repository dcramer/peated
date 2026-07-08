import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/collections/:collection/bottles", () => {
  test("cannot list private without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.collections.bottles.list(
        {
          user: otherUser.id,
          collection: "default",
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });

  test("cannot list private library without friend", async ({
    defaults,
    fixtures,
  }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.collections.bottles.list(
        {
          user: otherUser.id,
          collection: "library",
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.collections.bottles.list(
      {
        user: otherUser.id,
        collection: "default",
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.collections.bottles.list(
      {
        user: otherUser.id,
        collection: "default",
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list own bottles with me parameter", async ({
    defaults,
    fixtures,
  }) => {
    // Create some bottles and add them to the default collection
    const bottle1 = await fixtures.Bottle();
    const bottle2 = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle2.id });

    // Get the default collection
    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    // Add bottles to collection
    await db.insert(collectionBottles).values([
      {
        collectionId: defaultCollection.id,
        bottleId: bottle1.id,
        releaseId: null,
      },
      {
        collectionId: defaultCollection.id,
        bottleId: bottle2.id,
        releaseId: release.id,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(2);

    // Sort and verify bottle IDs
    const bottleIds = results.map((r) => r.bottle.id).sort();
    expect(bottleIds).toEqual([bottle1.id, bottle2.id].sort());

    // Verify both bottles are present with correct data
    const bottle1Result = results.find((r) => r.bottle.id === bottle1.id);
    const bottle2Result = results.find((r) => r.bottle.id === bottle2.id);

    expect(bottle1Result).toBeDefined();
    expect(bottle2Result).toBeDefined();
    expect(bottle1Result?.bottle.name).toBe(bottle1.name);
    expect(bottle2Result?.bottle.name).toBe(bottle2.name);
  });

  test("can list own library bottles with me parameter", async ({
    defaults,
    fixtures,
  }) => {
    const bottle1 = await fixtures.Bottle();
    const bottle2 = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: bottle1.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: bottle2.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id).sort()).toEqual(
      [bottle1.id, bottle2.id].sort(),
    );
  });

  test("serializes collection bottle image URLs and null image URLs", async ({
    defaults,
    fixtures,
  }) => {
    const bottleWithImage = await fixtures.Bottle();
    const bottleWithoutImage = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const imagePath = "/uploads/collection-bottles/library-entry.webp";

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: bottleWithImage.id,
        imageUrl: imagePath,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: bottleWithoutImage.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
      },
      { context: { user: defaults.user } },
    );

    const withImage = results.find(
      (result) => result.bottle.id === bottleWithImage.id,
    );
    const withoutImage = results.find(
      (result) => result.bottle.id === bottleWithoutImage.id,
    );

    expect(withImage?.imageUrl).toBe(
      `${new URL(config.API_SERVER).origin}${imagePath}`,
    );
    expect(withoutImage?.imageUrl).toBeNull();
  });

  test("lists legacy non-library collection for default alias", async ({
    defaults,
    fixtures,
  }) => {
    const favoriteBottle = await fixtures.Bottle();
    const libraryBottle = await fixtures.Bottle();
    const legacyCollection = await fixtures.Collection({
      name: "Personal Favorites",
      createdById: defaults.user.id,
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: legacyCollection.id,
        bottleId: favoriteBottle.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: libraryBottle.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([favoriteBottle.id]);
  });

  test("does not create missing reserved collection on read", async ({
    defaults,
  }) => {
    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
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

    expect(results).toHaveLength(0);
    expect(libraryCollection).toBeUndefined();
  });

  test("keeps favorites and library entries independent", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const defaultCollection = await fixtures.Collection({
      name: "Default",
      createdById: defaults.user.id,
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values({
      collectionId: defaultCollection.id,
      bottleId: bottle.id,
      releaseId: null,
    });

    const favoritesOnly = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
      },
      { context: { user: defaults.user } },
    );
    const emptyLibrary = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
      },
      { context: { user: defaults.user } },
    );

    expect(favoritesOnly.results.map((r) => r.bottle.id)).toEqual([bottle.id]);
    expect(emptyLibrary.results).toHaveLength(0);

    await db.insert(collectionBottles).values({
      collectionId: libraryCollection.id,
      bottleId: bottle.id,
      releaseId: null,
    });

    const library = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
      },
      { context: { user: defaults.user } },
    );

    expect(library.results.map((r) => r.bottle.id)).toEqual([bottle.id]);
  });

  test("can filter collection bottles by exact bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "B",
    });

    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    await db.insert(collectionBottles).values([
      {
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: release1.id,
      },
      {
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: release2.id,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        release: release2.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(results[0].bottle.id).toBe(bottle.id);
    expect(results[0].release?.id).toBe(release2.id);
  });

  test("can filter only the base bottle entry", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Store Pick",
    });

    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    await db.insert(collectionBottles).values([
      {
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: null,
      },
      {
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: release.id,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(results[0].bottle.id).toBe(bottle.id);
    expect(results[0].release).toBeNull();
  });

  test("can search library bottles by text", async ({ defaults, fixtures }) => {
    const brand = await fixtures.Entity({ name: "Search Library Brand" });
    const matchingBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Needle Label",
    });
    const otherBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Ordinary Label",
    });
    const outsideLibraryBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Needle Outside",
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: matchingBottle.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: otherBottle.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        query: "Needle",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([matchingBottle.id]);
    expect(results.map((r) => r.bottle.id)).not.toContain(
      outsideLibraryBottle.id,
    );
  });

  test("can filter library bottles by brand", async ({
    defaults,
    fixtures,
  }) => {
    const matchingBrand = await fixtures.Entity({ name: "Library Brand A" });
    const otherBrand = await fixtures.Entity({ name: "Library Brand B" });
    const matchingBottle = await fixtures.Bottle({
      brandId: matchingBrand.id,
      name: "Selected",
    });
    const otherBottle = await fixtures.Bottle({
      brandId: otherBrand.id,
      name: "Filtered Out",
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: matchingBottle.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: otherBottle.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        brand: matchingBrand.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([matchingBottle.id]);
  });

  test("can filter library bottles by distillery", async ({
    defaults,
    fixtures,
  }) => {
    const matchingDistiller = await fixtures.Entity({
      name: "Library Distillery A",
      type: ["distiller"],
    });
    const otherDistiller = await fixtures.Entity({
      name: "Library Distillery B",
      type: ["distiller"],
    });
    const matchingBottle = await fixtures.Bottle({
      name: "Selected",
      distillerIds: [matchingDistiller.id],
    });
    const otherBottle = await fixtures.Bottle({
      name: "Filtered Out",
      distillerIds: [otherDistiller.id],
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: matchingBottle.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: otherBottle.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        distiller: matchingDistiller.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([matchingBottle.id]);
  });

  test("can combine library search brand and distillery filters", async ({
    defaults,
    fixtures,
  }) => {
    const matchingBrand = await fixtures.Entity({ name: "Combined Brand A" });
    const otherBrand = await fixtures.Entity({ name: "Combined Brand B" });
    const matchingDistiller = await fixtures.Entity({
      name: "Combined Distillery A",
      type: ["distiller"],
    });
    const otherDistiller = await fixtures.Entity({
      name: "Combined Distillery B",
      type: ["distiller"],
    });
    const matchingBottle = await fixtures.Bottle({
      brandId: matchingBrand.id,
      name: "Shared Label Winner",
      distillerIds: [matchingDistiller.id],
    });
    const wrongBrandBottle = await fixtures.Bottle({
      brandId: otherBrand.id,
      name: "Shared Label Wrong Brand",
      distillerIds: [matchingDistiller.id],
    });
    const wrongDistillerBottle = await fixtures.Bottle({
      brandId: matchingBrand.id,
      name: "Shared Label Wrong Distillery",
      distillerIds: [otherDistiller.id],
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: matchingBottle.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: wrongBrandBottle.id,
        releaseId: null,
      },
      {
        collectionId: libraryCollection.id,
        bottleId: wrongDistillerBottle.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        query: "Shared",
        brand: matchingBrand.id,
        distiller: matchingDistiller.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([matchingBottle.id]);
  });

  test("can filter library bottles by status", async ({
    defaults,
    fixtures,
  }) => {
    const sealedBottle = await fixtures.Bottle({ name: "Status Sealed" });
    const openBottle = await fixtures.Bottle({ name: "Status Open" });
    const unsetBottle = await fixtures.Bottle({ name: "Status Unset" });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: sealedBottle.id,
        releaseId: null,
        status: "sealed",
      },
      {
        collectionId: libraryCollection.id,
        bottleId: openBottle.id,
        releaseId: null,
        status: "open",
      },
      {
        collectionId: libraryCollection.id,
        bottleId: unsetBottle.id,
        releaseId: null,
        status: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        status: "sealed",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([sealedBottle.id]);
    expect(results[0].status).toBe("sealed");
  });

  test("can filter library bottles by status using the collection id", async ({
    defaults,
    fixtures,
  }) => {
    const sealedBottle = await fixtures.Bottle({
      name: "Numeric Library Status Sealed",
    });
    const openBottle = await fixtures.Bottle({
      name: "Numeric Library Status Open",
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: sealedBottle.id,
        releaseId: null,
        status: "sealed",
      },
      {
        collectionId: libraryCollection.id,
        bottleId: openBottle.id,
        releaseId: null,
        status: "open",
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: libraryCollection.id,
        status: "sealed",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([sealedBottle.id]);
    expect(results[0].status).toBe("sealed");
  });

  test("can filter library bottles by unset status", async ({
    defaults,
    fixtures,
  }) => {
    const emptyBottle = await fixtures.Bottle({ name: "Status Empty" });
    const unsetBottle = await fixtures.Bottle({ name: "Status Not Set" });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: emptyBottle.id,
        releaseId: null,
        status: "empty",
      },
      {
        collectionId: libraryCollection.id,
        bottleId: unsetBottle.id,
        releaseId: null,
        status: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        status: "unset",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id)).toEqual([unsetBottle.id]);
    expect(results[0].status).toBeNull();
  });

  test("lists all library bottles when status filter is omitted", async ({
    defaults,
    fixtures,
  }) => {
    const sealedBottle = await fixtures.Bottle({ name: "Status Any Sealed" });
    const unsetBottle = await fixtures.Bottle({ name: "Status Any Unset" });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });

    await db.insert(collectionBottles).values([
      {
        collectionId: libraryCollection.id,
        bottleId: sealedBottle.id,
        releaseId: null,
        status: "sealed",
      },
      {
        collectionId: libraryCollection.id,
        bottleId: unsetBottle.id,
        releaseId: null,
        status: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
      },
      { context: { user: defaults.user } },
    );

    expect(results.map((r) => r.bottle.id).sort()).toEqual(
      [sealedBottle.id, unsetBottle.id].sort(),
    );
  });

  test("rejects library filters for other collection aliases", async ({
    defaults,
    fixtures,
  }) => {
    const matchingBrand = await fixtures.Entity({ name: "Default Brand A" });
    const otherBrand = await fixtures.Entity({ name: "Default Brand B" });
    const matchingDistiller = await fixtures.Entity({
      name: "Default Distillery A",
      type: ["distiller"],
    });
    const otherDistiller = await fixtures.Entity({
      name: "Default Distillery B",
      type: ["distiller"],
    });
    const keptBottle = await fixtures.Bottle({
      brandId: otherBrand.id,
      name: "Unmatched Default Bottle",
      distillerIds: [otherDistiller.id],
    });
    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    await db.insert(collectionBottles).values({
      collectionId: defaultCollection.id,
      bottleId: keptBottle.id,
      releaseId: null,
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.list(
        {
          user: "me",
          collection: "default",
          query: "Missing",
          brand: matchingBrand.id,
          distiller: matchingDistiller.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection filters are only supported for Library.]`,
    );
  });

  test("rejects status filter for other collection aliases", async ({
    defaults,
  }) => {
    const err = await waitError(() =>
      routerClient.collections.bottles.list(
        {
          user: "me",
          collection: "default",
          status: "sealed",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection filters are only supported for Library.]`,
    );
  });
});
