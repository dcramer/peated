import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleBarcodes,
  bottleFlavorProfiles,
  bottleGroups,
  bottleObservations,
  bottleReferences,
  bottleSeries,
  bottles,
  collectionBottles,
  countries,
  entities,
  externalReviews,
  flightBottles,
  incomingBottleDecisionLogs,
  regions,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import pg from "pg";
import { describe, expect, test } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))
       LIMIT 1`,
      [blockerPid],
    );
    if (result.rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Bottle deletion.");
}

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

  test("selects a remaining representative and repairs group and series counts", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const series = await fixtures.BottleSeries({ numReleases: 0 });
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
    await db
      .update(bottleGroups)
      .set({ totalBottles: 99 })
      .where(eq(bottleGroups.id, groupId));

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
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, representative.brandId),
      }),
    ).toMatchObject({ totalBottles: 1 });
  });

  test("waits for group statistics before locking member Bottles", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    await fixtures.BottleGroupMember({ groupId: bottle.groupId });
    const statistics = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let statisticsCommitted = false;
    let deletion: ReturnType<typeof routerClient.bottles.delete> | null = null;

    await statistics.connect();
    await observer.connect();
    try {
      await statistics.query("BEGIN");
      const statisticsPid = (
        await statistics.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        )
      ).rows[0]?.pid;
      if (!statisticsPid) {
        throw new Error("Unable to load BottleGroup statistics pid.");
      }
      await statistics.query(
        "SELECT id FROM bottle_group WHERE id = $1 FOR UPDATE",
        [bottle.groupId],
      );

      deletion = routerClient.bottles.delete(
        { bottle: bottle.id },
        { context: { user } },
      );
      void deletion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, statisticsPid);

      await statistics.query(
        "SELECT id FROM bottle WHERE group_id = $1 ORDER BY id FOR SHARE NOWAIT",
        [bottle.groupId],
      );
      await statistics.query("COMMIT");
      statisticsCommitted = true;
      await expect(deletion).resolves.toEqual({});
    } finally {
      if (!statisticsCommitted) {
        await statistics.query("ROLLBACK").catch(() => undefined);
      }
      if (deletion) await deletion.catch(() => undefined);
      await statistics.end();
      await observer.end();
    }

    await expect(
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, bottle.groupId),
      }),
    ).resolves.toMatchObject({ totalBottles: 1 });
  });

  test("deletes a Bottle when its Entity count is too low", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity();
    const country = await fixtures.Country({ totalBottles: 0 });
    const region = await fixtures.Region({
      countryId: country.id,
      totalBottles: 0,
    });
    const distillery = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });
    const removedBottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
    });
    await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distillery.id],
    });
    await db
      .update(entities)
      .set({ totalBottles: 0 })
      .where(eq(entities.id, brand.id));
    await db
      .update(countries)
      .set({ totalBottles: 0 })
      .where(eq(countries.id, country.id));
    await db
      .update(regions)
      .set({ totalBottles: 0 })
      .where(eq(regions.id, region.id));

    await routerClient.bottles.delete(
      { bottle: removedBottle.id },
      { context: { user } },
    );

    await expect(
      db.query.bottles.findFirst({
        where: eq(bottles.id, removedBottle.id),
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, brand.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(
      db.query.countries.findFirst({ where: eq(countries.id, country.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, region.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
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
    const bottleReference = await fixtures.BottleReference({
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
    const updatedBottleReference = await db.query.bottleReferences.findFirst({
      where: eq(bottleReferences.name, bottleReference.name),
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
    expect(updatedBottleReference).toMatchObject({
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
