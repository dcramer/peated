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

  test("rejects repair when no exact parent bottle exists", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Festival Distillery" });
    const legacyBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Warehouse Session (Batch 2)",
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
      `[Error: No exact reusable parent bottle exists for this repair.]`,
    );
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
