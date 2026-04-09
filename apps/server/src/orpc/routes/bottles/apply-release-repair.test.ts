import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleObservations,
  bottleReleases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  collectionBottles,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, inArray } from "drizzle-orm";

describe("POST /bottles/:bottle/apply-release-repair", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: 1,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("moves a legacy release-like bottle under the exact parent bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const distiller = await fixtures.Entity({ name: "Speyside Distillery" });
    const mod = await fixtures.User({ mod: true });

    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 50,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
      totalTastings: 12,
      description: "Legacy release description",
      imageUrl: "/images/legacy-abunadh.jpg",
      createdById: mod.id,
    });

    await db.insert(bottlesToDistillers).values({
      bottleId: legacyBottle.id,
      distillerId: distiller.id,
    });

    await db.insert(bottleAliases).values({
      bottleId: legacyBottle.id,
      name: "A'bunadh",
    });

    await db.insert(bottleTags).values({
      bottleId: parent.id,
      tag: "sherry",
      count: 2,
    });
    await db.insert(bottleTags).values({
      bottleId: legacyBottle.id,
      tag: "sherry",
      count: 3,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: parent.id,
      flavorProfile: "peated",
      count: 1,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: legacyBottle.id,
      flavorProfile: "peated",
      count: 4,
    });

    const releaseSpecificTasting = await fixtures.Tasting({
      bottleId: legacyBottle.id,
      rating: 4,
    });

    const collection = await fixtures.Collection();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: legacyBottle.id,
    });

    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: legacyBottle.id,
    });

    const externalSite = await fixtures.ExternalSite();
    await db.insert(bottleObservations).values({
      bottleId: legacyBottle.id,
      sourceType: "store_price",
      sourceKey: "legacy-abunadh-price",
      sourceName: legacyBottle.fullName,
      externalSiteId: externalSite.id,
      createdById: mod.id,
    });

    const genericReview = await fixtures.Review({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      issue: "Spring 2026",
      name: parent.fullName,
    });
    const releaseReview = await fixtures.Review({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      issue: "Fall 2026",
      name: legacyBottle.fullName,
    });

    const genericPrice = await fixtures.StorePrice({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      name: parent.fullName,
      volume: 700,
    });
    const releasePrice = await fixtures.StorePrice({
      bottleId: legacyBottle.id,
      externalSiteId: externalSite.id,
      name: legacyBottle.fullName,
      volume: 750,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: releasePrice.id,
        status: "approved",
        proposalType: "match_existing",
        currentBottleId: legacyBottle.id,
        suggestedBottleId: legacyBottle.id,
        parentBottleId: legacyBottle.id,
        reviewedById: mod.id,
        reviewedAt: new Date(),
      })
      .returning();

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      legacyBottleId: legacyBottle.id,
      parentBottleId: parent.id,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parent.id,
      edition: "Batch 32",
      description: "Legacy release description",
      imageUrl: "/images/legacy-abunadh.jpg",
    });

    const [deletedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, legacyBottle.id));
    expect(deletedBottle).toBeUndefined();

    const [tombstone] = await db
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, legacyBottle.id));
    expect(tombstone.newBottleId).toBe(parent.id);

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, releaseSpecificTasting.id));
    expect(tasting).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [collectionBottle] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(collectionBottle).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [flightBottle] = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(flightBottle).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [observation] = await db
      .select()
      .from(bottleObservations)
      .where(eq(bottleObservations.sourceKey, "legacy-abunadh-price"));
    expect(observation).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [updatedGenericReview, updatedReleaseReview] = await db
      .select()
      .from(reviews)
      .where(inArray(reviews.id, [genericReview.id, releaseReview.id]))
      .orderBy(reviews.id);
    expect(updatedGenericReview).toMatchObject({
      id: genericReview.id,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(updatedReleaseReview).toMatchObject({
      id: releaseReview.id,
      bottleId: parent.id,
      releaseId: release.id,
    });

    const [updatedGenericPrice, updatedReleasePrice] = await db
      .select()
      .from(storePrices)
      .where(inArray(storePrices.id, [genericPrice.id, releasePrice.id]))
      .orderBy(storePrices.id);
    expect(updatedGenericPrice).toMatchObject({
      id: genericPrice.id,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(updatedReleasePrice).toMatchObject({
      id: releasePrice.id,
      bottleId: parent.id,
      releaseId: release.id,
    });

    const legacyCanonicalAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, legacyBottle.fullName),
    });
    const genericAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "A'bunadh"),
    });
    expect(legacyCanonicalAlias).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
    });
    expect(genericAlias).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
    });

    const [tag] = await db
      .select()
      .from(bottleTags)
      .where(
        and(eq(bottleTags.bottleId, parent.id), eq(bottleTags.tag, "sherry")),
      );
    expect(tag.count).toBe(5);

    const [flavorProfile] = await db
      .select()
      .from(bottleFlavorProfiles)
      .where(
        and(
          eq(bottleFlavorProfiles.bottleId, parent.id),
          eq(bottleFlavorProfiles.flavorProfile, "peated"),
        ),
      );
    expect(flavorProfile.count).toBe(5);

    const parentDistillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, parent.id));
    expect(parentDistillers.map((row) => row.distillerId)).toContain(
      distiller.id,
    );

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    expect(updatedProposal).toMatchObject({
      currentBottleId: null,
      currentReleaseId: null,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: null,
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
    });

    const [deleteChange] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          eq(changes.objectId, legacyBottle.id),
          eq(changes.type, "delete"),
        ),
      );
    expect(deleteChange).toBeDefined();
    expect(deleteChange.type).toBe("delete");
  });

  test("creates a reusable parent bottle when no exact parent bottle exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Festival Distillery",
      totalBottles: 1,
    });
    const distiller = await fixtures.Entity({ name: "Warehouse Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
      statedAge: 12,
      category: "single_malt",
      flavorProfile: "spicy_sweet",
    });
    await db.insert(bottlesToDistillers).values({
      bottleId: legacyBottle.id,
      distillerId: distiller.id,
    });
    await db.insert(bottleAliases).values({
      bottleId: legacyBottle.id,
      name: "Festival Distillery Warehouse Session",
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.parentBottleId));
    expect(parentBottle).toMatchObject({
      id: result.parentBottleId,
      brandId: brand.id,
      name: "Warehouse Session",
      fullName: "Festival Distillery Warehouse Session",
      statedAge: 12,
      category: "single_malt",
      flavorProfile: "spicy_sweet",
      edition: null,
      releaseYear: null,
      numReleases: 1,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "Batch 2",
      statedAge: 12,
    });

    const genericAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, parentBottle.fullName),
    });
    expect(genericAlias).toMatchObject({
      bottleId: parentBottle.id,
      releaseId: null,
    });

    const [deletedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, legacyBottle.id));
    expect(deletedBottle).toBeUndefined();

    const parentDistillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, parentBottle.id));
    expect(parentDistillers.map((row) => row.distillerId)).toContain(
      distiller.id,
    );

    const refreshedBrand = await db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, brand.id),
    });
    expect(refreshedBrand?.totalBottles).toBe(1);
  });

  test("creates a reusable parent bottle for branded generic-name releases", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Lagavulin",
      totalBottles: 1,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Distillers Edition",
      edition: "2011 Release",
      releaseYear: 2011,
      category: "single_malt",
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    const [parentBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.parentBottleId));
    expect(parentBottle).toMatchObject({
      id: result.parentBottleId,
      brandId: brand.id,
      name: "Distillers Edition",
      fullName: "Lagavulin Distillers Edition",
      releaseYear: null,
      edition: null,
      numReleases: 1,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: parentBottle.id,
      edition: "2011 Release",
      releaseYear: 2011,
    });
  });

  test("prefers a clean exact-name parent when a dirtier duplicate also exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const dirtyParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 100,
    });
    await db
      .update(bottles)
      .set({ edition: "Batch 31" })
      .where(eq(bottles.id, dirtyParent.id));
    const cleanParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh Parent Placeholder",
      totalTastings: 50,
    });
    await db
      .update(bottles)
      .set({
        name: "A'bunadh",
        fullName: dirtyParent.fullName,
      })
      .where(eq(bottles.id, cleanParent.id));
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
    });
    const mod = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.parentBottleId).toBe(cleanParent.id);

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release.bottleId).toBe(cleanParent.id);
  });

  test("reuses an existing release without duplicating collection or flight rows", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      totalTastings: 80,
    });
    const existingRelease = await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "Batch 32",
      description: null,
      imageUrl: "https://example.com/existing-release.png",
      tastingNotes: null,
      createdById: mod.id,
    });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
      description: "Recovered legacy description",
      imageUrl: "/images/legacy-abunadh.png",
      tastingNotes: {
        nose: "Raisin",
        palate: "Chocolate",
        finish: "Spice",
      },
      createdById: mod.id,
    });

    const collection = await fixtures.Collection();
    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: parent.id,
        releaseId: existingRelease.id,
      },
      {
        collectionId: collection.id,
        bottleId: legacyBottle.id,
      },
    ]);

    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values([
      {
        flightId: flight.id,
        bottleId: parent.id,
        releaseId: existingRelease.id,
      },
      {
        flightId: flight.id,
        bottleId: legacyBottle.id,
      },
    ]);

    const result = await routerClient.bottles.applyReleaseRepair(
      {
        bottle: legacyBottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.releaseId).toBe(existingRelease.id);

    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, existingRelease.id));
    expect(updatedRelease).toMatchObject({
      description: "Recovered legacy description",
      imageUrl: "https://example.com/existing-release.png",
      tastingNotes: {
        nose: "Raisin",
        palate: "Chocolate",
        finish: "Spice",
      },
    });

    const collectionRows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(collectionRows).toHaveLength(1);
    expect(collectionRows[0]).toMatchObject({
      collectionId: collection.id,
      bottleId: parent.id,
      releaseId: existingRelease.id,
    });

    const flightRows = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(flightRows).toHaveLength(1);
    expect(flightRows[0]).toMatchObject({
      flightId: flight.id,
      bottleId: parent.id,
      releaseId: existingRelease.id,
    });
  });

  test("rejects repair when the exact-name parent is still release-specific", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const dirtyParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
    });
    await db
      .update(bottles)
      .set({ edition: "Batch 31" })
      .where(eq(bottles.id, dirtyParent.id));
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh (Batch 32)",
    });
    const mod = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.applyReleaseRepair(
        {
          bottle: legacyBottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Exact parent bottle still contains bottle-level release traits.]`,
    );
  });
});
