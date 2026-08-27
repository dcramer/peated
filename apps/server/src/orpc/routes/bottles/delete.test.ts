import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleBarcodes,
  bottleFlavorProfiles,
  bottleGroups,
  bottleObservations,
  bottleSeries,
  bottles,
  collectionBottles,
  externalReviews,
  flightBottles,
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
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
  test("deletes a legacy ungrouped bottle", async ({ fixtures }) => {
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

  test("deletes a grouped singleton and its group", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({ name: "Grouped Singleton" });
    const groupId = bottle.groupId;
    await routerClient.bottles.delete(
      { bottle: bottle.id },
      { context: { user } },
    );

    expect(await loadGroupedBottleGraph(groupId)).toEqual({
      group: [],
      members: [],
    });
    expect(
      await db.query.bottleTombstones.findFirst({
        where: (table, { eq }) => eq(table.bottleId, bottle.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, newBottleId: null });
  });

  test("selects a remaining representative and recomputes group and series counts", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const series = await fixtures.BottleSeries({ numReleases: 2 });
    const representative = await fixtures.Bottle({
      name: "Grouped Representative",
      brandId: series.brandId,
      seriesId: series.id,
    });
    const groupId = representative.groupId;
    const sibling = await fixtures.BottleGroupMember({
      groupId,
      edition: "Batch 2",
    });

    const before = await loadGroupedBottleGraph(groupId);
    expect(before.group[0]?.representativeBottleId).toBe(representative.id);
    expect(before.members).toHaveLength(2);

    await routerClient.bottles.delete(
      { bottle: representative.id },
      { context: { user } },
    );

    const after = await loadGroupedBottleGraph(groupId);
    expect(after.members.map(({ id }) => id)).toEqual([sibling.id]);
    expect(after.group[0]).toMatchObject({
      representativeBottleId: sibling.id,
      totalBottles: 1,
    });
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).toMatchObject({ numReleases: 1 });
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

  test("clears system-owned Bottle ids when deleting a Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.LegacyBottle();
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    const review = await fixtures.ExternalReview({
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
    await db.insert(bottleBarcodes).values({
      bottleId: bottle.id,
      value: "96385074",
      gtin14: "00000096385074",
      createdByActorId: actor.id,
    });
    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "store_price",
      sourceId: price.id,
      externalSiteId: price.externalSiteId,
      name: price.name,
      decision: "create_bottle",
      actorId: actor.id,
      bottleId: bottle.id,
      createdBottle: true,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        currentBottleId: bottle.id,
        suggestedBottleId: bottle.id,
        legacyParentBottleId: bottle.id,
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
    const updatedReview = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, review.id),
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
    const deletedBarcode = await db.query.bottleBarcodes.findFirst({
      where: eq(bottleBarcodes.bottleId, bottle.id),
    });
    const preservedDecisionLog =
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.sourceId, price.id),
      });

    expect(updatedPrice?.bottleId).toBeNull();
    expect(updatedReview?.bottleId).toBeNull();
    expect(updatedProposal).toMatchObject({
      currentBottleId: null,
      suggestedBottleId: null,
      legacyParentBottleId: null,
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
    expect(deletedBarcode).toBeUndefined();
    expect(preservedDecisionLog).toMatchObject({ bottleId: null });
  });
});
