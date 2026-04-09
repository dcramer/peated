import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleObservations,
  bottleReleases,
  bottles,
  collectionBottles,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, inArray, isNull } from "drizzle-orm";

describe("POST /bottles/:bottle/apply-dirty-parent-release-repair", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.applyDirtyParentReleaseRepair(
        {
          bottle: 1,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("splits a dirty exact-name parent into a clean parent plus child release", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      edition: "Batch 31",
      statedAge: 12,
      description: "Dirty parent description",
      imageUrl: "/images/abunadh-batch31.png",
      createdById: mod.id,
    });

    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      rating: 4,
    });
    const collection = await fixtures.Collection();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });
    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
    });

    const externalSite = await fixtures.ExternalSite();
    await db.insert(bottleObservations).values({
      bottleId: bottle.id,
      sourceType: "store_price",
      sourceKey: "dirty-parent-price",
      sourceName: bottle.fullName,
      externalSiteId: externalSite.id,
      createdById: mod.id,
    });

    const review = await fixtures.Review({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      issue: "Spring 2026",
      name: bottle.fullName,
    });
    const storePrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      name: bottle.fullName,
      volume: 700,
    });
    await db.insert(storePriceMatchProposals).values({
      priceId: storePrice.id,
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      parentBottleId: bottle.id,
      reviewedById: mod.id,
      reviewedAt: new Date(),
    });

    const result = await routerClient.bottles.applyDirtyParentReleaseRepair(
      {
        bottle: bottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.bottleId).toBe(bottle.id);

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle).toMatchObject({
      id: bottle.id,
      edition: null,
      releaseYear: null,
      vintageYear: null,
      abv: null,
      singleCask: null,
      caskStrength: null,
      caskFill: null,
      caskType: null,
      caskSize: null,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      tastingNotes: null,
      statedAge: 12,
    });

    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(release).toMatchObject({
      bottleId: bottle.id,
      edition: "Batch 31",
      statedAge: 12,
      description: "Dirty parent description",
      imageUrl: "/images/abunadh-batch31.png",
    });

    const genericAlias = await db.query.bottleAliases.findFirst({
      where: and(
        eq(bottleAliases.bottleId, bottle.id),
        eq(bottleAliases.name, bottle.fullName),
        isNull(bottleAliases.releaseId),
      ),
    });
    expect(genericAlias).toBeDefined();

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const [updatedStorePrice] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, storePrice.id));
    expect(updatedStorePrice).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.priceId, storePrice.id),
    });
    expect(updatedProposal).toMatchObject({
      currentBottleId: bottle.id,
      currentReleaseId: release.id,
      suggestedBottleId: bottle.id,
      suggestedReleaseId: release.id,
      parentBottleId: bottle.id,
    });

    const [updatedTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    expect(updatedTasting).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const [updatedCollectionBottle] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(updatedCollectionBottle).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const [updatedFlightBottle] = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(updatedFlightBottle).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const [updatedObservation] = await db
      .select()
      .from(bottleObservations)
      .where(eq(bottleObservations.sourceKey, "dirty-parent-price"));
    expect(updatedObservation).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });
  });

  test("reuses an existing release when the dirty parent already matches one", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Lagavulin" });
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Distillers Edition",
      edition: "2011 Release",
      releaseYear: 2011,
      description: "Recovered metadata",
      createdById: mod.id,
    });
    const existingRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "2011 Release",
      releaseYear: 2011,
      description: null,
      createdById: mod.id,
    });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      name: bottle.fullName,
    });

    const result = await routerClient.bottles.applyDirtyParentReleaseRepair(
      {
        bottle: bottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.releaseId).toBe(existingRelease.id);

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle).toMatchObject({
      edition: null,
      releaseYear: null,
    });

    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, existingRelease.id));
    expect(updatedRelease).toMatchObject({
      description: "Recovered metadata",
    });

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: existingRelease.id,
    });
  });

  test("rejects non-dirty parent bottles", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      name: "Clean Parent",
    });

    const err = await waitError(
      routerClient.bottles.applyDirtyParentReleaseRepair(
        {
          bottle: bottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Bottle does not contain bottle-level release traits to repair.]`,
    );
  });
});
