import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleBarcodes,
  bottleFlavorProfiles,
  bottleGroups,
  bottleObservations,
  bottles,
  bottleTags,
  bottleTombstones,
  changes,
  collectionBottles,
  collections,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  BottleMergeAuthorizationError,
  BottleMergeConflictError,
  BottleMergeGraphError,
  mergeBottles,
  mergeBottlesInTransaction,
} from "@peated/server/lib/mergeBottles";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

function contextFor(user: User | null) {
  return { user } as Parameters<typeof mergeBottles>[0]["context"];
}

describe("exact Bottle merges", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushUniqueJob).mockReset();
    vi.mocked(workerClient.pushUniqueJob).mockResolvedValue(undefined);
  });

  test("converges direct consumers, aliases, mappings, and aggregates on the selected Bottle", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const source = await fixtures.Bottle({
      name: "Merge Source",
      totalTastings: 99,
    });
    const destination = await fixtures.Bottle({
      name: "Merge Destination",
      totalTastings: 99,
    });
    const sourceGroupId = source.groupId!;
    const destinationGroupId = destination.groupId!;
    const user = await fixtures.User();
    const externalSite = await fixtures.ExternalSite();
    const collectionWithCollision = await fixtures.Collection();
    const collectionToMove = await fixtures.Collection();
    const flightWithCollision = await fixtures.Flight();
    const sourceAlias = await fixtures.BottleAlias({
      bottleId: source.id,
      name: "Retired exact alias",
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });

    const sourceTasting = await fixtures.Tasting({
      bottleId: source.id,
      createdById: user.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      rating: 4,
    });
    const destinationTasting = await fixtures.Tasting({
      bottleId: destination.id,
      createdById: user.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      rating: 3,
    });
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: externalSite.id,
        name: "Merge review",
        bottleId: source.id,
        rating: 88,
        issue: "1",
        url: "https://example.com/merge-review",
      })
      .returning();
    const [price] = await db
      .insert(storePrices)
      .values({
        externalSiteId: externalSite.id,
        name: "Merge listing",
        bottleId: source.id,
        price: 10000,
        currency: "usd",
        volume: 750,
        url: "https://example.com/merge-price",
      })
      .returning();
    const [observation] = await db
      .insert(bottleObservations)
      .values({
        bottleId: source.id,
        sourceType: "store_price",
        sourceKey: "store_price:merge",
        sourceName: "Merge observation",
      })
      .returning();
    const [barcode] = await db
      .insert(bottleBarcodes)
      .values({
        bottleId: source.id,
        value: "96385074",
        gtin14: "00000096385074",
        createdByActorId: actor.id,
      })
      .returning();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price!.id,
        proposalType: "match_existing",
        currentBottleId: source.id,
        suggestedBottleId: source.id,
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price!.id,
        proposalId: proposal!.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        currentBottleId: source.id,
        suggestedBottleId: source.id,
      })
      .returning();
    const [decisionLog] = await db
      .insert(incomingBottleDecisionLogs)
      .values({
        sourceKind: "store_price",
        sourceId: price!.id,
        proposalId: proposal!.id,
        externalSiteId: externalSite.id,
        name: price!.name,
        url: price!.url,
        decision: "match_existing",
        actorId: actor.id,
        bottleId: source.id,
      })
      .returning();

    await db.insert(collectionBottles).values([
      {
        collectionId: collectionWithCollision.id,
        bottleId: source.id,
        imageUrl: "https://example.com/source.jpg",
      },
      {
        collectionId: collectionWithCollision.id,
        bottleId: destination.id,
      },
      {
        collectionId: collectionToMove.id,
        bottleId: source.id,
      },
    ]);
    await db.insert(flightBottles).values([
      { flightId: flightWithCollision.id, bottleId: source.id },
      { flightId: flightWithCollision.id, bottleId: destination.id },
    ]);
    await db.insert(bottleTags).values({
      bottleId: source.id,
      tag: "smoke",
      count: 2,
    });
    await db.insert(bottleTags).values({
      bottleId: destination.id,
      tag: "smoke",
      count: 3,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: source.id,
      flavorProfile: "peated",
      count: 2,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: destination.id,
      flavorProfile: "peated",
      count: 3,
    });

    const result = await mergeBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: contextFor(mod),
    });

    expect(result).toMatchObject({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      changed: true,
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, source.id),
      }),
    ).toMatchObject({ newBottleId: destination.id });
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, sourceGroupId),
      }),
    ).toBeUndefined();

    expect(
      await db
        .select({ id: tastings.id, bottleId: tastings.bottleId })
        .from(tastings)
        .where(inArray(tastings.id, [sourceTasting.id, destinationTasting.id])),
    ).toEqual(
      expect.arrayContaining([
        { id: sourceTasting.id, bottleId: destination.id },
        { id: destinationTasting.id, bottleId: destination.id },
      ]),
    );
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review!.id),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price!.id),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, observation!.id),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.bottleBarcodes.findFirst({
        where: eq(bottleBarcodes.id, barcode!.id),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.id, decisionLog!.id),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal!.id),
      }),
    ).toMatchObject({
      currentBottleId: destination.id,
      suggestedBottleId: destination.id,
    });
    expect(
      await db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt!.id),
      }),
    ).toMatchObject({
      currentBottleId: destination.id,
      suggestedBottleId: destination.id,
    });

    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collectionWithCollision.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: destination.id,
        imageUrl: "https://example.com/source.jpg",
      }),
    ]);
    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collectionToMove.id)),
    ).toEqual([expect.objectContaining({ bottleId: destination.id })]);
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, flightWithCollision.id)),
    ).toEqual([expect.objectContaining({ bottleId: destination.id })]);

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, sourceAlias.name),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.bottleTags.findFirst({
        where: and(
          eq(bottleTags.bottleId, destination.id),
          eq(bottleTags.tag, "smoke"),
        ),
      }),
    ).toMatchObject({ count: 5 });
    expect(
      await db.query.bottleFlavorProfiles.findFirst({
        where: and(
          eq(bottleFlavorProfiles.bottleId, destination.id),
          eq(bottleFlavorProfiles.flavorProfile, "peated"),
        ),
      }),
    ).toMatchObject({ count: 5 });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, destination.id),
      }),
    ).toMatchObject({ totalTastings: 2 });
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, destinationGroupId),
      }),
    ).toMatchObject({ totalBottles: 1, totalTastings: 2 });

    const auditRows = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          inArray(changes.objectId, [source.id, destination.id]),
        ),
      );
    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: source.id,
          type: "delete",
          data: expect.objectContaining({
            updateScope: "exact_merge",
            consumerCounts: expect.objectContaining({
              tastings: 1,
              storePrices: 1,
              collectionMembershipsCollapsed: 1,
              flightMembershipsCollapsed: 1,
            }),
          }),
        }),
        expect.objectContaining({
          objectId: destination.id,
          type: "update",
        }),
      ]),
    );
    expect(
      await db.query.changes.findFirst({
        where: and(
          eq(changes.objectType, "bottle_group"),
          eq(changes.objectId, sourceGroupId),
          eq(changes.type, "delete"),
        ),
      }),
    ).toMatchObject({
      data: expect.objectContaining({
        updateScope: "exact_merge",
        replacementGroupId: destinationGroupId,
      }),
    });

    expect(
      await mergeBottles({
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        context: contextFor(mod),
      }),
    ).toMatchObject({ changed: false });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: destination.id,
    });
  });

  test("normalizes colliding direct memberships to one Bottle row", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Membership Source" });
    const destination = await fixtures.Bottle({
      name: "Membership Destination",
    });
    const collection = await fixtures.Collection({ totalBottles: 2 });
    const flight = await fixtures.Flight();

    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: source.id,
        imageUrl: "https://example.com/source.jpg",
      },
      {
        collectionId: collection.id,
        bottleId: destination.id,
        imageUrl: "https://example.com/destination.jpg",
      },
    ]);
    await db.insert(flightBottles).values([
      {
        flightId: flight.id,
        bottleId: source.id,
      },
      {
        flightId: flight.id,
        bottleId: destination.id,
      },
    ]);

    await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(
      await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collection.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: destination.id,
        imageUrl: "https://example.com/destination.jpg",
      }),
    ]);
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).toMatchObject({ totalBottles: 1 });
    expect(
      await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, flight.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: destination.id,
      }),
    ]);
  });

  test("selects the surviving member when merging the representative within one group", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Same Group Source" });
    const destination = await fixtures.BottleGroupMember({
      groupId: source.groupId!,
      edition: "Destination",
    });

    const manifest = await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(manifest.changed).toBe(true);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, source.groupId!),
      }),
    ).toMatchObject({
      representativeBottleId: destination.id,
      totalBottles: 1,
    });
  });

  test("selects a deterministic surviving representative for a cross-group merge", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Representative Source" });
    const firstSurvivor = await fixtures.BottleGroupMember({
      groupId: source.groupId!,
      edition: "First Survivor",
    });
    const secondSurvivor = await fixtures.BottleGroupMember({
      groupId: source.groupId!,
      edition: "Second Survivor",
    });
    const destination = await fixtures.Bottle({
      name: "Representative Destination",
    });

    await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, source.groupId!),
      }),
    ).toMatchObject({
      representativeBottleId: firstSurvivor.id,
      totalBottles: 2,
    });
    expect(
      await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(inArray(bottles.id, [firstSurvivor.id, secondSurvivor.id])),
    ).toHaveLength(2);
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, source.id),
      }),
    ).toMatchObject({ newBottleId: destination.id });
  });

  test("keeps a canonical alias assigned to a surviving source-group Bottle", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const sourceGroupBottle = await fixtures.Bottle({
      name: "Retained General Bottle",
    });
    const source = await fixtures.BottleGroupMember({
      groupId: sourceGroupBottle.groupId!,
      edition: "Duplicate Release",
    });
    const destination = await fixtures.Bottle({
      name: "Canonical Release",
    });
    const [canonicalAlias] = await db
      .update(bottleAliases)
      .set({ bottleId: sourceGroupBottle.id })
      .where(eq(bottleAliases.name, source.fullName))
      .returning();
    if (!canonicalAlias) throw new Error("Expected the canonical alias.");

    await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, canonicalAlias.name),
      }),
    ).toMatchObject({ bottleId: sourceGroupBottle.id });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.id),
      }),
    ).toBeUndefined();
  });

  test("keeps a canonical alias assigned to a surviving destination-group Bottle", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({
      name: "Destination Group Alias Source",
    });
    const destinationGroupBottle = await fixtures.Bottle({
      name: "Destination Group Alias Owner",
    });
    const destination = await fixtures.BottleGroupMember({
      groupId: destinationGroupBottle.groupId!,
      edition: "Canonical Release",
    });
    const [canonicalAlias] = await db
      .update(bottleAliases)
      .set({ bottleId: destinationGroupBottle.id })
      .where(eq(bottleAliases.name, source.fullName))
      .returning();
    if (!canonicalAlias) throw new Error("Expected the canonical alias.");

    await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, canonicalAlias.name),
      }),
    ).toMatchObject({ bottleId: destinationGroupBottle.id });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.id),
      }),
    ).toBeUndefined();
  });

  test("claims an unassigned canonical alias for the destination", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Unassigned Alias Source" });
    const destination = await fixtures.Bottle({
      name: "Unassigned Alias Destination",
    });
    await db
      .update(bottleAliases)
      .set({ bottleId: null, ignored: true })
      .where(eq(bottleAliases.name, source.fullName));

    await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, source.fullName),
      }),
    ).toMatchObject({
      bottleId: destination.id,
      ignored: false,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
  });

  test("rejects a canonical alias assigned outside both merge groups", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Reserved Alias Source" });
    const destination = await fixtures.Bottle({
      name: "Reserved Alias Destination",
    });
    const conflictingBottle = await fixtures.Bottle({
      name: "Reserved Alias Owner",
    });
    await db
      .update(bottleAliases)
      .set({ bottleId: conflictingBottle.id })
      .where(eq(bottleAliases.name, source.fullName));

    await expect(
      db.transaction((tx) =>
        mergeBottlesInTransaction(tx, {
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          actorId: actor.id,
        }),
      ),
    ).rejects.toEqual(new BottleMergeConflictError("identity_conflict"));
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.id),
      }),
    ).toBeDefined();
  });

  test("rolls back when direct tasting identity would collide", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Collision Source" });
    const destination = await fixtures.Bottle({
      name: "Collision Destination",
    });
    const user = await fixtures.User();
    const createdAt = new Date("2026-03-01T00:00:00.000Z");
    await fixtures.Tasting({
      bottleId: source.id,
      createdById: user.id,
      createdAt,
    });
    await fixtures.Tasting({
      bottleId: destination.id,
      createdById: user.id,
      createdAt,
    });

    await expect(
      db.transaction((tx) =>
        mergeBottlesInTransaction(tx, {
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
          actorId: actor.id,
        }),
      ),
    ).rejects.toEqual(new BottleMergeConflictError("consumer_conflict"));
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, source.id),
      }),
    ).toBeDefined();
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, source.id),
      }),
    ).toBeUndefined();
  });

  test("rejects retired destinations and a source already merged elsewhere", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const source = await fixtures.Bottle({ name: "Retirement Source" });
    const firstDestination = await fixtures.Bottle({
      name: "First Destination",
    });
    const otherDestination = await fixtures.Bottle({
      name: "Other Destination",
    });

    await db.transaction((tx) =>
      mergeBottlesInTransaction(tx, {
        sourceBottleId: source.id,
        destinationBottleId: firstDestination.id,
        actorId: actor.id,
      }),
    );

    await expect(
      db.transaction((tx) =>
        mergeBottlesInTransaction(tx, {
          sourceBottleId: source.id,
          destinationBottleId: otherDestination.id,
          actorId: actor.id,
        }),
      ),
    ).rejects.toEqual(
      new BottleMergeConflictError("retired_to_other_destination"),
    );
    await expect(
      db.transaction((tx) =>
        mergeBottlesInTransaction(tx, {
          sourceBottleId: otherDestination.id,
          destinationBottleId: source.id,
          actorId: actor.id,
        }),
      ),
    ).rejects.toEqual(new BottleMergeGraphError("retired", source.id));
  });

  test("enforces moderator authorization at the public boundary", async ({
    defaults,
  }) => {
    await expect(
      mergeBottles({
        sourceBottleId: 1,
        destinationBottleId: 2,
        context: contextFor(defaults.user),
      }),
    ).rejects.toBeInstanceOf(BottleMergeAuthorizationError);
  });
});
