import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleObservations,
  bottleReleases,
  bottles,
  collectionBottles,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /bottles/:bottle", () => {
  test("deletes bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.delete(
      { bottle: bottle.id },
      {
        context: { user },
      },
    );
    expect(data).toEqual({});

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle).toBeUndefined();
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const err = await waitError(
      routerClient.bottles.delete({ bottle: bottle.id }, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("blocks delete when the bottle is used in tastings", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    await fixtures.Tasting({ bottleId: bottle.id });

    const err = await waitError(
      routerClient.bottles.delete(
        { bottle: bottle.id },
        {
          context: { user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete bottle while it is used in tastings.]`,
    );
  });

  test("blocks delete when the bottle is used in collections", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection();

    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      releaseId: null,
    });

    const err = await waitError(
      routerClient.bottles.delete(
        { bottle: bottle.id },
        {
          context: { user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete bottle while it is used in collections.]`,
    );
  });

  test("blocks delete when the bottle is used in flights", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight();

    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
      releaseId: null,
    });

    const err = await waitError(
      routerClient.bottles.delete(
        { bottle: bottle.id },
        {
          context: { user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete bottle while it is used in flights.]`,
    );
  });

  test("clears system-owned bottle and release references when deleting a bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, price.id));
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
    });
    const reviewer = await fixtures.User();
    const priorQueueEntryAt = new Date("2026-03-01T00:30:00.000Z");
    const bottleAlias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Deleted Bottle Alias",
    });
    const releaseAlias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: "Deleted Release Alias",
    });

    await db.insert(bottleFlavorProfiles).values({
      bottleId: bottle.id,
      flavorProfile: "peated",
      count: 2,
    });
    await db.insert(bottleObservations).values({
      bottleId: bottle.id,
      releaseId: release.id,
      sourceType: "store_price",
      sourceKey: `store_price:${price.id}`,
      sourceName: price.name,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        currentBottleId: bottle.id,
        currentReleaseId: release.id,
        suggestedBottleId: bottle.id,
        suggestedReleaseId: release.id,
        parentBottleId: bottle.id,
        enteredQueueAt: priorQueueEntryAt,
        reviewedById: reviewer.id,
        reviewedAt: new Date("2026-03-11T00:30:00.000Z"),
      })
      .returning();

    await routerClient.bottles.delete(
      { bottle: bottle.id },
      {
        context: { user },
      },
    );

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    const updatedBottleAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, bottleAlias.name),
    });
    const updatedReleaseAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, releaseAlias.name),
    });
    const deletedRelease = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, release.id),
    });
    const remainingFlavorProfiles = await db
      .select()
      .from(bottleFlavorProfiles)
      .where(eq(bottleFlavorProfiles.bottleId, bottle.id));
    const deletedObservation = await db.query.bottleObservations.findFirst({
      where: (table, { eq }) => eq(table.sourceKey, `store_price:${price.id}`),
    });

    expect(updatedPrice?.bottleId).toBeNull();
    expect(updatedPrice?.releaseId).toBeNull();
    expect(updatedReview?.bottleId).toBeNull();
    expect(updatedReview?.releaseId).toBeNull();
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
    expect(updatedBottleAlias).toMatchObject({
      bottleId: null,
      releaseId: null,
    });
    expect(updatedReleaseAlias).toMatchObject({
      bottleId: null,
      releaseId: null,
    });
    expect(updatedProposal?.enteredQueueAt).not.toBeNull();
    expect(updatedProposal!.enteredQueueAt!.getTime()).toBeGreaterThan(
      priorQueueEntryAt.getTime(),
    );
    expect(deletedRelease).toBeUndefined();
    expect(remainingFlavorProfiles).toHaveLength(0);
    expect(deletedObservation).toBeUndefined();
  });
});
