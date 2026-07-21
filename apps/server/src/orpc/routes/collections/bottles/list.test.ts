import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  type Bottle,
  bottleGroupDistillers,
  bottleGroups,
  bottleReleasePromotions,
  bottles,
  catalogTargets,
  collectionBottles,
} from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function exactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottleId),
    columns: { id: true },
  });
  if (!target) throw new Error(`Exact target not found for Bottle ${bottleId}`);
  return target.id;
}

async function insertTargetBackedCollectionBottles(
  values:
    | typeof collectionBottles.$inferInsert
    | (typeof collectionBottles.$inferInsert)[],
) {
  const valueList = Array.isArray(values) ? values : [values];
  await db.insert(collectionBottles).values(
    await Promise.all(
      valueList.map(async (value) => ({
        ...value,
        targetId: value.targetId ?? (await exactTargetId(value.bottleId)),
      })),
    ),
  );
}

function targetBottleId(
  result: Awaited<
    ReturnType<typeof routerClient.collections.bottles.list>
  >["results"][number],
) {
  return result.target.kind === "bottle" ? result.target.bottle.id : null;
}

async function promoteRelease(releaseId: number, parent: Bottle) {
  const [promotedBottle] = await db
    .insert(bottles)
    .values({
      groupId: parent.groupId,
      brandId: parent.brandId,
      createdByActorId: parent.createdByActorId,
      name: `${parent.name} promoted ${releaseId}`,
      fullName: `${parent.fullName} promoted ${releaseId}`,
    })
    .returning();
  if (!promotedBottle || parent.groupId === null) {
    throw new Error("Unable to create promoted Bottle fixture");
  }
  const [target] = await db
    .insert(catalogTargets)
    .values({ groupId: parent.groupId, bottleId: promotedBottle.id })
    .returning();
  if (!target) throw new Error("Unable to create promoted target fixture");
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: promotedBottle.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return { promotedBottle, target };
}

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

  test("serializes exact and generic durable targets without representative substitution", async ({
    defaults,
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle({ name: "Exact collection" });
    const groupedBottle = await fixtures.Bottle({ name: "Generic collection" });
    if (!groupedBottle.groupId) throw new Error("BottleGroup fixture missing");
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, groupedBottle.groupId!),
          isNull(catalogTargets.bottleId),
        ),
    });
    if (!genericTarget) throw new Error("Generic target fixture missing");
    const collection = await getDefaultCollection(db, defaults.user.id);
    if (!collection) throw new Error("Default collection not found");

    await insertTargetBackedCollectionBottles([
      {
        collectionId: collection.id,
        bottleId: exactBottle.id,
        targetId: await exactTargetId(exactBottle.id),
      },
      {
        collectionId: collection.id,
        bottleId: groupedBottle.id,
        targetId: genericTarget.id,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      { user: "me", collection: "default" },
      { context: { user: defaults.user } },
    );

    expect(
      results.find((result) => result.target.kind === "bottle")?.target,
    ).toMatchObject({
      kind: "bottle",
      bottle: { id: exactBottle.id, fullName: exactBottle.fullName },
    });
    const genericResult = results.find(
      (result) => result.target.kind === "group",
    );
    expect(genericResult?.target).toMatchObject({
      kind: "group",
      targetId: genericTarget.id,
      group: { id: groupedBottle.groupId },
    });
    expect(genericResult?.target).not.toHaveProperty("bottle");

    const filtered = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
        target: genericTarget.id,
      },
      { context: { user: defaults.user } },
    );
    expect(filtered.results).toHaveLength(1);
    expect(filtered.results[0].target).toMatchObject({
      kind: "group",
      targetId: genericTarget.id,
    });
  });

  test("derives current-user tasting state only from the durable target", async ({
    defaults,
    fixtures,
  }) => {
    const tastedBottle = await fixtures.Bottle({ name: "Target tasted" });
    const legacyOnlyBottle = await fixtures.Bottle({
      name: "Legacy-only tasted",
    });
    const tastedTargetId = await exactTargetId(tastedBottle.id);
    const legacyOnlyTargetId = await exactTargetId(legacyOnlyBottle.id);
    const collection = await getDefaultCollection(db, defaults.user.id);
    if (!collection) throw new Error("Default collection not found");
    await insertTargetBackedCollectionBottles([
      {
        collectionId: collection.id,
        bottleId: tastedBottle.id,
        targetId: tastedTargetId,
      },
      {
        collectionId: collection.id,
        bottleId: legacyOnlyBottle.id,
        targetId: legacyOnlyTargetId,
      },
    ]);
    await fixtures.Tasting({
      bottleId: tastedBottle.id,
      targetId: tastedTargetId,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: legacyOnlyBottle.id,
      targetId: null,
      createdById: defaults.user.id,
    });

    const { results } = await routerClient.collections.bottles.list(
      { user: "me", collection: "default" },
      { context: { user: defaults.user } },
    );

    expect(
      results.find(({ target }) => target.targetId === tastedTargetId)
        ?.hasTasted,
    ).toBe(true);
    expect(
      results.find(({ target }) => target.targetId === legacyOnlyTargetId)
        ?.hasTasted,
    ).toBe(false);
  });

  test("rejects a targetless membership instead of falling back to its retained pair", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await getDefaultCollection(db, defaults.user.id);
    if (!collection) throw new Error("Default collection not found");
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      targetId: null,
    });

    const error = await waitError(() =>
      routerClient.collections.bottles.list(
        { user: "me", collection: "default" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error.message).toContain("has no durable CatalogTarget");
  });

  test("paginates target-backed memberships deterministically", async ({
    defaults,
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle({ name: "Pagination A" });
    const secondBottle = await fixtures.Bottle({ name: "Pagination B" });
    const expectedBottleIds = [firstBottle, secondBottle]
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .map((bottle) => bottle.id);
    const collection = await getDefaultCollection(db, defaults.user.id);
    if (!collection) throw new Error("Default collection not found");
    await insertTargetBackedCollectionBottles([
      { collectionId: collection.id, bottleId: firstBottle.id },
      { collectionId: collection.id, bottleId: secondBottle.id },
    ]);

    const firstPage = await routerClient.collections.bottles.list(
      { user: "me", collection: "default", limit: 1 },
      { context: { user: defaults.user } },
    );
    const secondPage = await routerClient.collections.bottles.list(
      { user: "me", collection: "default", limit: 1, cursor: 2 },
      { context: { user: defaults.user } },
    );

    expect(firstPage.results.map(targetBottleId)).toEqual([
      expectedBottleIds[0],
    ]);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.results.map(targetBottleId)).toEqual([
      expectedBottleIds[1],
    ]);
    expect(secondPage.rel.prevCursor).toBe(1);
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
    await insertTargetBackedCollectionBottles([
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
    const bottleIds = results.map(targetBottleId).sort();
    expect(bottleIds).toEqual([bottle1.id, bottle2.id].sort());

    // Verify both bottles are present with correct data
    const bottle1Result = results.find(
      (result) => targetBottleId(result) === bottle1.id,
    );
    const bottle2Result = results.find(
      (result) => targetBottleId(result) === bottle2.id,
    );

    expect(bottle1Result).toBeDefined();
    expect(bottle2Result).toBeDefined();
    expect(bottle1Result?.target.kind).toBe("bottle");
    expect(bottle2Result?.target.kind).toBe("bottle");
    if (bottle1Result?.target.kind !== "bottle") return;
    if (bottle2Result?.target.kind !== "bottle") return;
    expect(bottle1Result.target.bottle.name).toBe(bottle1.name);
    expect(bottle2Result.target.bottle.name).toBe(bottle2.name);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId).sort()).toEqual(
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

    await insertTargetBackedCollectionBottles([
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
      (result) => targetBottleId(result) === bottleWithImage.id,
    );
    const withoutImage = results.find(
      (result) => targetBottleId(result) === bottleWithoutImage.id,
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([favoriteBottle.id]);
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

    await insertTargetBackedCollectionBottles({
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

    expect(favoritesOnly.results.map(targetBottleId)).toEqual([bottle.id]);
    expect(emptyLibrary.results).toHaveLength(0);

    await insertTargetBackedCollectionBottles({
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

    expect(library.results.map(targetBottleId)).toEqual([bottle.id]);
  });

  test("can filter collection bottles by exact bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Selected exact Bottle" });
    const otherBottle = await fixtures.Bottle({ name: "Other exact Bottle" });

    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    await insertTargetBackedCollectionBottles([
      {
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: null,
      },
      {
        collectionId: defaultCollection.id,
        bottleId: otherBottle.id,
        releaseId: null,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(targetBottleId(results[0])).toBe(bottle.id);
    expect(results[0].target.targetId).toBe(await exactTargetId(bottle.id));
  });

  test("can filter only the base bottle entry", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();

    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    await insertTargetBackedCollectionBottles([
      {
        collectionId: defaultCollection.id,
        bottleId: bottle.id,
        releaseId: null,
      },
      {
        collectionId: defaultCollection.id,
        bottleId: otherBottle.id,
        releaseId: null,
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
    expect(targetBottleId(results[0])).toBe(bottle.id);
  });

  test("preserves standalone base-only compatibility", async ({
    defaults,
    fixtures,
  }) => {
    const baseBottle = await fixtures.Bottle({ name: "Standalone base" });
    const releaseBottle = await fixtures.Bottle({ name: "Standalone release" });
    const release = await fixtures.BottleRelease({
      bottleId: releaseBottle.id,
    });
    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) throw new Error("Default collection not found");
    await insertTargetBackedCollectionBottles([
      {
        collectionId: defaultCollection.id,
        bottleId: baseBottle.id,
        releaseId: null,
      },
      {
        collectionId: defaultCollection.id,
        bottleId: releaseBottle.id,
        releaseId: release.id,
      },
    ]);

    const { results } = await routerClient.collections.bottles.list(
      { user: "me", collection: "default", baseOnly: true },
      { context: { user: defaults.user } },
    );

    expect(results.map(targetBottleId)).toEqual([baseBottle.id]);
  });

  test("preserves legacy family, base-only, and release filter intent across promoted targets", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Legacy family parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease(release.id, parent);
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, parent.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture missing");
    const collection = await getDefaultCollection(db, defaults.user.id);
    if (!collection) throw new Error("Default collection not found");

    await insertTargetBackedCollectionBottles([
      {
        collectionId: collection.id,
        bottleId: parent.id,
        releaseId: null,
        targetId: genericTarget.id,
      },
      {
        collectionId: collection.id,
        bottleId: promoted.promotedBottle.id,
        releaseId: null,
        targetId: promoted.target.id,
      },
    ]);

    const family = await routerClient.collections.bottles.list(
      { user: "me", collection: "default", bottle: parent.id },
      { context: { user: defaults.user } },
    );
    const baseOnly = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
        bottle: parent.id,
        baseOnly: true,
      },
      { context: { user: defaults.user } },
    );
    const specificRelease = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "default",
        bottle: parent.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    expect(family.results.map(({ target }) => target.targetId).sort()).toEqual(
      [genericTarget.id, promoted.target.id].sort(),
    );
    expect(baseOnly.results.map(({ target }) => target.targetId)).toEqual([
      genericTarget.id,
    ]);
    expect(
      specificRelease.results.map(({ target }) => target.targetId),
    ).toEqual([promoted.target.id]);
    expect(targetBottleId(specificRelease.results[0])).toBe(
      promoted.promotedBottle.id,
    );
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([matchingBottle.id]);
    expect(results.map(targetBottleId)).not.toContain(outsideLibraryBottle.id);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([matchingBottle.id]);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([matchingBottle.id]);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([matchingBottle.id]);
  });

  test("filters a generic group target by group query, brand, and distillery", async ({
    defaults,
    fixtures,
  }) => {
    const groupBrand = await fixtures.Entity({ name: "Generic Group Brand" });
    const retainedBrand = await fixtures.Entity({
      name: "Generic Retained Brand",
    });
    const groupDistiller = await fixtures.Entity({
      name: "Generic Filter Distillery",
      type: ["distiller"],
    });
    const retainedDistiller = await fixtures.Entity({
      name: "Generic Retained Distillery",
      type: ["distiller"],
    });
    const retainedBottle = await fixtures.Bottle({
      brandId: retainedBrand.id,
      name: "Retained Label Must Not Match",
      distillerIds: [retainedDistiller.id],
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, retainedBottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture missing");
    await db
      .update(bottleGroups)
      .set({
        brandId: groupBrand.id,
        name: "Generic Group Needle",
        fullName: "Generic Group Needle",
      })
      .where(eq(bottleGroups.id, retainedBottle.groupId as number));
    await db
      .delete(bottleGroupDistillers)
      .where(
        eq(bottleGroupDistillers.groupId, retainedBottle.groupId as number),
      );
    await db.insert(bottleGroupDistillers).values({
      groupId: retainedBottle.groupId as number,
      distillerId: groupDistiller.id,
    });
    const aliasCarrier = await fixtures.Bottle({
      name: "Unrelated generic alias carrier",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: aliasCarrier.id,
      targetId: genericTarget.id,
      name: "Generic Group Alias",
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    await insertTargetBackedCollectionBottles({
      collectionId: libraryCollection.id,
      bottleId: retainedBottle.id,
      targetId: genericTarget.id,
    });

    const { results } = await routerClient.collections.bottles.list(
      {
        user: "me",
        collection: "library",
        query: "Needle",
        brand: groupBrand.id,
        distiller: groupDistiller.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(results[0].target).toMatchObject({
      kind: "group",
      targetId: genericTarget.id,
      group: { id: retainedBottle.groupId },
    });
    expect(results[0].target).not.toHaveProperty("bottle");

    const aliasResults = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", query: alias.name },
      { context: { user: defaults.user } },
    );
    expect(aliasResults.results.map(({ target }) => target.targetId)).toEqual([
      genericTarget.id,
    ]);
  });

  test("uses exact target identity and alias when the retained Bottle diverges", async ({
    defaults,
    fixtures,
  }) => {
    const authoritativeBottle = await fixtures.Bottle({
      name: "Authoritative Exact Needle",
    });
    const retainedBottle = await fixtures.Bottle({
      name: "Retained Exact Decoy",
    });
    const targetId = await exactTargetId(authoritativeBottle.id);
    const alias = await fixtures.BottleAlias({
      bottleId: authoritativeBottle.id,
      targetId,
      name: "Authoritative Exact Alias",
    });
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    await insertTargetBackedCollectionBottles({
      collectionId: libraryCollection.id,
      bottleId: retainedBottle.id,
      targetId,
    });

    for (const query of ["Authoritative", alias.name]) {
      const { results } = await routerClient.collections.bottles.list(
        { user: "me", collection: "library", query },
        { context: { user: defaults.user } },
      );
      expect(results.map(({ target }) => target.targetId)).toEqual([targetId]);
    }
    const retainedResults = await routerClient.collections.bottles.list(
      { user: "me", collection: "library", query: "Decoy" },
      { context: { user: defaults.user } },
    );
    expect(retainedResults.results).toHaveLength(0);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([sealedBottle.id]);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([sealedBottle.id]);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId)).toEqual([unsetBottle.id]);
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

    await insertTargetBackedCollectionBottles([
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

    expect(results.map(targetBottleId).sort()).toEqual(
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

    await insertTargetBackedCollectionBottles({
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
