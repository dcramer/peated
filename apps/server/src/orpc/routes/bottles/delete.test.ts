import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroups,
  bottleObservations,
  bottles,
  collectionBottles,
  flightBottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { bottleReleases } from "@peated/server/lib/test/legacyCatalogSchema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function loadGroupedBottleGraph(groupId: number) {
  const members = await db
    .select()
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(bottles.id);

  const group = await db
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .orderBy(bottleGroups.id);
  return { group, members };
}

describe("DELETE /bottles/:bottle", () => {
  test("deletes bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.LegacyBottle();

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
    const bottle = await fixtures.LegacyBottle();

    const err = await waitError(
      routerClient.bottles.delete({ bottle: bottle.id }, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns not found for a missing bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(
      routerClient.bottles.delete({ bottle: 999_999 }, { context: { user } }),
    );

    expect(err).toMatchObject({ status: 404 });
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("requires an explicit merge destination for a grouped singleton", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({ name: "Grouped Singleton" });
    const groupId = bottle.groupId as number;
    const before = await loadGroupedBottleGraph(groupId);
    expect(before.group[0]?.representativeBottleId).toBe(bottle.id);
    expect(before.members).toHaveLength(1);

    const err = await waitError(
      routerClient.bottles.delete({ bottle: bottle.id }, { context: { user } }),
    );

    expect(err).toMatchObject({ status: 409 });
    expect(err).toMatchInlineSnapshot(
      `[Error: Grouped Bottles cannot be deleted directly. Merge this Bottle into an explicit destination Bottle instead.]`,
    );
    expect(await loadGroupedBottleGraph(groupId)).toEqual(before);
    expect(
      await db.query.bottleTombstones.findFirst({
        where: (table, { eq }) => eq(table.bottleId, bottle.id),
      }),
    ).toBeUndefined();
  });

  test("preserves a grouped representative and non-representative", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const representative = await fixtures.Bottle({
      name: "Grouped Representative",
    });
    const sibling = await fixtures.LegacyBottle({
      brandId: representative.brandId,
      name: "Grouped Representative - Batch 2",
    });
    const groupId = representative.groupId as number;

    await db.transaction(async (tx) => {
      await tx
        .update(bottles)
        .set({ groupId })
        .where(eq(bottles.id, sibling.id));
      await tx
        .update(bottleGroups)
        .set({ totalBottles: 2 })
        .where(eq(bottleGroups.id, groupId));
    });

    const before = await loadGroupedBottleGraph(groupId);
    expect(before.group[0]?.representativeBottleId).toBe(representative.id);
    expect(before.members).toHaveLength(2);

    for (const bottleId of [representative.id, sibling.id]) {
      const err = await waitError(
        routerClient.bottles.delete(
          { bottle: bottleId },
          { context: { user } },
        ),
      );
      expect(err).toMatchObject({ status: 409 });
      expect(err.message).toBe(
        "Grouped Bottles cannot be deleted directly. Merge this Bottle into an explicit destination Bottle instead.",
      );
      expect(
        await db.query.bottleTombstones.findFirst({
          where: (table, { eq }) => eq(table.bottleId, bottleId),
        }),
      ).toBeUndefined();
    }

    expect(await loadGroupedBottleGraph(groupId)).toEqual(before);
  });

  test("blocks delete when the bottle is used in tastings", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.LegacyBottle();

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
    const bottle = await fixtures.LegacyBottle();
    const collection = await fixtures.Collection();

    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
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
    const bottle = await fixtures.LegacyBottle();
    const flight = await fixtures.Flight();

    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
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

  test("clears system-owned bottle references when deleting a bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.LegacyBottle();
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    const review = await fixtures.Review({
      bottleId: bottle.id,
    });
    const reviewer = await fixtures.User();
    const priorQueueEntryAt = new Date("2026-03-01T00:30:00.000Z");
    const bottleAlias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Deleted Bottle Alias",
    });

    await db.insert(bottleFlavorProfiles).values({
      bottleId: bottle.id,
      flavorProfile: "peated",
      count: 2,
    });
    await db.insert(bottleObservations).values({
      bottleId: bottle.id,
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
        suggestedBottleId: bottle.id,
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
    const remainingFlavorProfiles = await db
      .select()
      .from(bottleFlavorProfiles)
      .where(eq(bottleFlavorProfiles.bottleId, bottle.id));
    const deletedObservation = await db.query.bottleObservations.findFirst({
      where: (table, { eq }) => eq(table.sourceKey, `store_price:${price.id}`),
    });

    expect(updatedPrice?.bottleId).toBeNull();
    expect(updatedReview?.bottleId).toBeNull();
    expect(updatedProposal).toMatchObject({
      currentBottleId: null,
      suggestedBottleId: null,
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
    });
    expect(updatedBottleAlias).toMatchObject({
      bottleId: null,
    });
    expect(updatedProposal?.enteredQueueAt).not.toBeNull();
    expect(updatedProposal!.enteredQueueAt!.getTime()).toBeGreaterThan(
      priorQueueEntryAt.getTime(),
    );
    expect(remainingFlavorProfiles).toHaveLength(0);
    expect(deletedObservation).toBeUndefined();
  });
});
