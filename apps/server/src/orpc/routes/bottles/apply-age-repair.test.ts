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
import { eq, inArray } from "drizzle-orm";

describe("POST /bottles/:bottle/apply-age-repair", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.applyAgeRepair(
        {
          bottle: 1,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a parent-age release and moves bottle-scoped rows onto it", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Glenglassaugh" });
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "1978 Rare Cask Release",
      statedAge: 40,
      description: "Legacy 40-year-old description",
      imageUrl: "https://example.com/40yo.png",
      tastingNotes: {
        nose: "Polished oak",
        palate: "Dried fruit",
        finish: "Old leather",
      },
      createdById: mod.id,
    });
    const batch1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 35,
      totalTastings: 4,
    });
    const externalSite = await fixtures.ExternalSite();
    const collection = await fixtures.Collection();
    const flight = await fixtures.Flight();

    await db
      .update(bottles)
      .set({ numReleases: 1 })
      .where(eq(bottles.id, bottle.id));

    await db.insert(bottleAliases).values({
      bottleId: bottle.id,
      name: "Glenglassaugh 1978 Rare Cask Release 40-year-old",
    });

    const genericReview = await fixtures.Review({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      issue: "Issue 1",
      name: bottle.fullName,
    });
    const childReview = await fixtures.Review({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      issue: "Issue 2",
      name: batch1.fullName,
    });
    const genericPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      name: bottle.fullName,
    });
    const childPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: externalSite.id,
      name: batch1.fullName,
    });
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      rating: 4,
    });

    await db.insert(bottleObservations).values({
      bottleId: bottle.id,
      sourceType: "store_price",
      sourceKey: "dirty-parent-age",
      sourceName: bottle.fullName,
      externalSiteId: externalSite.id,
      createdById: mod.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
    });

    const [genericPriceProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: genericPrice.id,
        status: "approved",
        proposalType: "match_existing",
        currentBottleId: bottle.id,
        currentReleaseId: null,
        suggestedBottleId: bottle.id,
        suggestedReleaseId: null,
        reviewedById: mod.id,
        reviewedAt: new Date(),
      })
      .returning();

    const result = await routerClient.bottles.applyAgeRepair(
      {
        bottle: bottle.id,
      },
      { context: { user: mod } },
    );

    const [createdRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, result.releaseId));
    expect(createdRelease).toMatchObject({
      bottleId: bottle.id,
      fullName: "Glenglassaugh 1978 Rare Cask Release - 40-year-old",
      statedAge: 40,
      description: "Legacy 40-year-old description",
      imageUrl: "https://example.com/40yo.png",
      tastingNotes: {
        nose: "Polished oak",
        palate: "Dried fruit",
        finish: "Old leather",
      },
    });

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle).toMatchObject({
      id: bottle.id,
      statedAge: null,
      description: null,
      imageUrl: null,
      tastingNotes: null,
      numReleases: 2,
    });

    const [updatedTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    expect(updatedTasting).toMatchObject({
      id: tasting.id,
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });

    const [observation] = await db
      .select()
      .from(bottleObservations)
      .where(eq(bottleObservations.sourceKey, "dirty-parent-age"));
    expect(observation).toMatchObject({
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });

    const [collectionBottle] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(collectionBottle).toMatchObject({
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });

    const [flightBottle] = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(flightBottle).toMatchObject({
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });

    const [updatedGenericReview, updatedChildReview] = await db
      .select()
      .from(reviews)
      .where(inArray(reviews.id, [genericReview.id, childReview.id]))
      .orderBy(reviews.id);
    expect(updatedGenericReview).toMatchObject({
      id: genericReview.id,
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });
    expect(updatedChildReview).toMatchObject({
      id: childReview.id,
      bottleId: bottle.id,
      releaseId: batch1.id,
    });

    const [updatedGenericPrice, updatedChildPrice] = await db
      .select()
      .from(storePrices)
      .where(inArray(storePrices.id, [genericPrice.id, childPrice.id]))
      .orderBy(storePrices.id);
    expect(updatedGenericPrice).toMatchObject({
      id: genericPrice.id,
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });
    expect(updatedChildPrice).toMatchObject({
      id: childPrice.id,
      bottleId: bottle.id,
      releaseId: batch1.id,
    });

    const updatedGenericPriceProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, genericPriceProposal.id),
      });
    expect(updatedGenericPriceProposal).toMatchObject({
      id: genericPriceProposal.id,
      currentBottleId: bottle.id,
      currentReleaseId: createdRelease.id,
      suggestedBottleId: bottle.id,
      suggestedReleaseId: createdRelease.id,
      status: "approved",
    });

    const genericAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, bottle.fullName),
    });
    expect(genericAlias).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });

    const explicitAgeAlias = await db.query.bottleAliases.findFirst({
      where: eq(
        bottleAliases.name,
        "Glenglassaugh 1978 Rare Cask Release 40-year-old",
      ),
    });
    expect(explicitAgeAlias).toMatchObject({
      bottleId: bottle.id,
      releaseId: createdRelease.id,
    });
  });

  test("reuses an existing parent-age release and de-dupes collection and flight rows", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Glenglassaugh" });
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "1978 Rare Cask Release",
      statedAge: 40,
      description: "Recovered 40-year-old description",
      imageUrl: "https://example.com/recovered-40yo.png",
      tastingNotes: {
        nose: "Wax",
        palate: "Citrus oil",
        finish: "Long oak",
      },
      createdById: mod.id,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 35,
    });
    const existingRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      statedAge: 40,
      description: null,
      imageUrl: null,
      tastingNotes: null,
    });
    const collection = await fixtures.Collection();
    const flight = await fixtures.Flight();

    await db
      .update(bottles)
      .set({ numReleases: 2 })
      .where(eq(bottles.id, bottle.id));

    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: bottle.id,
      },
      {
        collectionId: collection.id,
        bottleId: bottle.id,
        releaseId: existingRelease.id,
      },
    ]);
    await db.insert(flightBottles).values([
      {
        flightId: flight.id,
        bottleId: bottle.id,
      },
      {
        flightId: flight.id,
        bottleId: bottle.id,
        releaseId: existingRelease.id,
      },
    ]);

    const result = await routerClient.bottles.applyAgeRepair(
      {
        bottle: bottle.id,
      },
      { context: { user: mod } },
    );

    expect(result.releaseId).toBe(existingRelease.id);

    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, existingRelease.id));
    expect(updatedRelease).toMatchObject({
      id: existingRelease.id,
      description: "Recovered 40-year-old description",
      imageUrl: "https://example.com/recovered-40yo.png",
      tastingNotes: {
        nose: "Wax",
        palate: "Citrus oil",
        finish: "Long oak",
      },
    });

    const collectionRows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    expect(collectionRows).toHaveLength(1);
    expect(collectionRows[0]).toMatchObject({
      collectionId: collection.id,
      bottleId: bottle.id,
      releaseId: existingRelease.id,
    });

    const flightRows = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(flightRows).toHaveLength(1);
    expect(flightRows[0]).toMatchObject({
      flightId: flight.id,
      bottleId: bottle.id,
      releaseId: existingRelease.id,
    });
  });

  test("rejects marketed-age bottles", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Springbank" });
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "10yo",
      statedAge: 10,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      statedAge: 12,
    });

    await db
      .update(bottles)
      .set({ numReleases: 1 })
      .where(eq(bottles.id, bottle.id));

    const err = await waitError(
      routerClient.bottles.applyAgeRepair(
        {
          bottle: bottle.id,
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Bottle markets its statedAge in the name and cannot use dirty parent age repair.]`,
    );
  });
});
