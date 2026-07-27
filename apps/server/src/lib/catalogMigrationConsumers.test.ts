import { getUserActor } from "@peated/server/lib/actors";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  bottleAliases,
  bottleObservations,
  bottleReleasePromotions,
  collectionBottles,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
} from "../db/schema";
import {
  CATALOG_MIGRATION_CONSUMER_SLOTS,
  CatalogMigrationConsumerError,
  type CatalogMigrationConsumerMapping,
  assertLegacyConsumersPromotedInTransaction,
  preflightLegacyConsumersInTransaction,
  repointLegacyConsumersInTransaction,
} from "./catalogMigrationConsumers";

async function createPromotedFamily(
  fixtures: typeof Fixtures,
  label: string,
): Promise<{
  mapping: CatalogMigrationConsumerMapping;
  parent: Awaited<ReturnType<typeof fixtures.Bottle>>;
  promoted: Awaited<ReturnType<typeof fixtures.Bottle>>;
}> {
  const parent = await fixtures.Bottle({
    name: `${label} parent`,
    fullName: `${label} parent`,
  });
  if (parent.groupId === null) throw new Error("Fixture Bottle has no group.");
  const release = await fixtures.BottleRelease({
    bottleId: parent.id,
    name: `${label} release`,
    fullName: `${label} release`,
    edition: `${label} edition`,
  });
  const promoted = await fixtures.BottleGroupMember({
    groupId: parent.groupId,
    edition: `${label} edition`,
  });
  const actor = await getUserActor(await fixtures.User());
  await db.insert(bottleReleasePromotions).values({
    releaseId: release.id,
    promotedBottleId: promoted.id,
    status: "promoted",
    startedAt: new Date("2024-01-01T00:00:00.000Z"),
    completedAt: new Date("2024-01-01T00:01:00.000Z"),
    createdByActorId: actor.id,
  });
  return {
    mapping: {
      releaseId: release.id,
      legacyParentBottleId: parent.id,
      promotedBottleId: promoted.id,
    },
    parent,
    promoted,
  };
}

async function expectConsumerError(
  promise: Promise<unknown>,
  expected: Partial<CatalogMigrationConsumerError>,
) {
  const error = await waitError(promise);
  expect(error).toBeInstanceOf(CatalogMigrationConsumerError);
  expect(error).toMatchObject(expected);
  return error as CatalogMigrationConsumerError;
}

async function run() {
  return await db.transaction(async (tx) => {
    const preflight = await preflightLegacyConsumersInTransaction(tx);
    return await repointLegacyConsumersInTransaction(tx, preflight);
  });
}

describe("repointLegacyConsumersInTransaction", () => {
  test("repoints all 12 release slots and preserves retained evidence", async ({
    fixtures,
  }) => {
    const { mapping, parent, promoted } = await createPromotedFamily(
      fixtures,
      "complete",
    );
    const user = await fixtures.User();
    const actor = await getUserActor(user);
    const externalSite = await fixtures.ExternalSite();
    const collection = await fixtures.Collection({
      name: "complete collection",
      createdById: user.id,
    });
    const flight = await fixtures.Flight({
      name: "complete flight",
      createdById: user.id,
    });
    const createdAt = new Date("2024-02-03T04:05:06.000Z");
    const candidateBottles = [{ bottleId: parent.id, retained: true }];

    const [alias] = await db
      .insert(bottleAliases)
      .values({
        name: "complete release alias",
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        ignored: false,
        assignmentSource: "legacy",
        assignedByActorId: actor.id,
        createdAt,
      })
      .returning();
    const [observation] = await db
      .insert(bottleObservations)
      .values({
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        sourceType: "store_price",
        sourceKey: "complete-observation",
        sourceName: "complete observation",
        rawText: "retained raw text",
        facts: { retained: true },
        createdAt,
        updatedAt: createdAt,
        createdById: user.id,
      })
      .returning();
    const [tasting] = await db
      .insert(tastings)
      .values({
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        tags: ["retained"],
        rating: 4,
        notes: "retained tasting",
        createdAt,
        createdById: user.id,
      })
      .returning();
    const [review] = await db
      .insert(reviews)
      .values({
        externalSiteId: externalSite.id,
        name: "complete review",
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        rating: 90,
        issue: "complete issue",
        url: "https://example.test/complete/review",
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    const [collectionBottle] = await db
      .insert(collectionBottles)
      .values({
        collectionId: collection.id,
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        imageUrl: "https://example.test/complete/collection.jpg",
        status: "open",
        createdAt,
      })
      .returning();
    const [flightBottle] = await db
      .insert(flightBottles)
      .values({
        flightId: flight.id,
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
      })
      .returning();
    const [price] = await db
      .insert(storePrices)
      .values({
        externalSiteId: externalSite.id,
        name: "complete price",
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        price: 12_345,
        currency: "usd",
        volume: 750,
        url: "https://example.test/complete/price",
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    if (
      !alias ||
      !observation ||
      !tasting ||
      !review ||
      !collectionBottle ||
      !flightBottle ||
      !price
    ) {
      throw new Error("Unable to create direct consumer fixtures.");
    }

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        currentBottleId: parent.id,
        currentReleaseId: mapping.releaseId,
        currentTargetId: null,
        suggestedBottleId: parent.id,
        suggestedReleaseId: mapping.releaseId,
        suggestedTargetId: null,
        parentBottleId: parent.id,
        candidateBottles,
        rationale: "retained proposal",
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    if (!proposal) throw new Error("Unable to create proposal fixture.");
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        currentBottleId: parent.id,
        currentReleaseId: mapping.releaseId,
        currentTargetId: null,
        suggestedBottleId: parent.id,
        suggestedReleaseId: mapping.releaseId,
        suggestedTargetId: null,
        parentBottleId: parent.id,
        automationEligible: false,
        model: "retained-model",
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    const [decision] = await db
      .insert(incomingBottleDecisionLogs)
      .values({
        sourceKind: "store_price",
        sourceId: price.id,
        proposalId: proposal.id,
        externalSiteId: externalSite.id,
        name: "complete decision",
        decision: "match_existing",
        actorId: actor.id,
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        targetId: null,
        metadata: { retained: true },
        createdAt,
      })
      .returning();
    if (!attempt || !decision) {
      throw new Error("Unable to create decision consumer fixtures.");
    }

    const [parentOnlyTasting] = await db
      .insert(tastings)
      .values({
        bottleId: parent.id,
        releaseId: null,
        targetId: null,
        tags: ["parent-only"],
        rating: 3,
        createdAt: new Date("2024-02-03T04:05:07.000Z"),
        createdById: user.id,
      })
      .returning();
    const [unresolvedAlias] = await db
      .insert(bottleAliases)
      .values({
        name: "complete unresolved alias",
        bottleId: null,
        releaseId: null,
        targetId: null,
        ignored: true,
        assignmentSource: "legacy",
        assignedByActorId: actor.id,
        createdAt,
      })
      .returning();
    if (!parentOnlyTasting || !unresolvedAlias) {
      throw new Error("Unable to create untouched fixtures.");
    }

    const result = await run();

    expect(result).toEqual({
      bySlot: Object.fromEntries(
        CATALOG_MIGRATION_CONSUMER_SLOTS.map((slot) => [slot, 1]),
      ),
      total: 12,
    });

    const [
      aliasAfter,
      observationAfter,
      tastingAfter,
      reviewAfter,
      collectionAfter,
      flightAfter,
      priceAfter,
      proposalAfter,
      attemptAfter,
      decisionAfter,
      parentOnlyAfter,
      unresolvedAfter,
    ] = await Promise.all([
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
      db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.id, observation.id),
      }),
      db.query.tastings.findFirst({ where: eq(tastings.id, tasting.id) }),
      db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
      db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, collectionBottle.id),
      }),
      db.query.flightBottles.findFirst({
        where: and(
          eq(flightBottles.flightId, flight.id),
          eq(flightBottles.releaseId, mapping.releaseId),
        ),
      }),
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt.id),
      }),
      db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.id, decision.id),
      }),
      db.query.tastings.findFirst({
        where: eq(tastings.id, parentOnlyTasting.id),
      }),
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, unresolvedAlias.name),
      }),
    ]);

    expect(aliasAfter).toEqual({ ...alias, bottleId: promoted.id });
    expect(observationAfter).toEqual({
      ...observation,
      bottleId: promoted.id,
    });
    expect(tastingAfter).toEqual({ ...tasting, bottleId: promoted.id });
    expect(reviewAfter).toEqual({ ...review, bottleId: promoted.id });
    expect(collectionAfter).toEqual({
      ...collectionBottle,
      bottleId: promoted.id,
    });
    expect(flightAfter).toEqual({ ...flightBottle, bottleId: promoted.id });
    expect(priceAfter).toEqual({ ...price, bottleId: promoted.id });
    expect(proposalAfter).toEqual({
      ...proposal,
      currentBottleId: promoted.id,
      suggestedBottleId: promoted.id,
    });
    expect(attemptAfter).toEqual({
      ...attempt,
      currentBottleId: promoted.id,
      suggestedBottleId: promoted.id,
    });
    expect(decisionAfter).toEqual({ ...decision, bottleId: promoted.id });
    expect(parentOnlyAfter).toEqual(parentOnlyTasting);
    expect(unresolvedAfter).toEqual(unresolvedAlias);

    expect(
      await db.transaction(async (tx) =>
        assertLegacyConsumersPromotedInTransaction(tx),
      ),
    ).toEqual(result);
  });

  test("preflights high-cardinality consumers before promotions exist", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({
      name: "high-cardinality parent",
      fullName: "high-cardinality parent",
    });
    if (parent.groupId === null) {
      throw new Error("Fixture Bottle has no group.");
    }
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "high-cardinality release",
      fullName: "high-cardinality release",
    });
    const actor = await getUserActor(await fixtures.User());
    const aliasCount = 200;
    await db.insert(bottleAliases).values(
      Array.from({ length: aliasCount }, (_, index) => ({
        name: `high-cardinality release alias ${index}`,
        bottleId: parent.id,
        releaseId: release.id,
        assignedByActorId: actor.id,
      })),
    );

    const preflight = await db.transaction(async (tx) =>
      preflightLegacyConsumersInTransaction(tx),
    );
    expect(preflight.bySlot.bottle_alias).toBe(aliasCount);
    expect(preflight.total).toBe(aliasCount);

    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId,
      edition: "high-cardinality",
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      startedAt: new Date("2024-01-01T00:00:00.000Z"),
      completedAt: new Date("2024-01-01T00:01:00.000Z"),
      createdByActorId: actor.id,
    });

    const result = await db.transaction(async (tx) =>
      repointLegacyConsumersInTransaction(tx, preflight),
    );
    expect(result.bySlot.bottle_alias).toBe(aliasCount);
    expect(result.total).toBe(aliasCount);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(
          and(
            eq(bottleAliases.bottleId, promoted.id),
            eq(bottleAliases.releaseId, release.id),
          ),
        ),
    ).toHaveLength(aliasCount);
  });

  test("rejects an invalid retained pair before changing another slot", async ({
    fixtures,
  }) => {
    const { mapping, parent } = await createPromotedFamily(
      fixtures,
      "invalid-pair",
    );
    const otherBottle = await fixtures.Bottle();
    const actor = await getUserActor(await fixtures.User());
    const site = await fixtures.ExternalSite();
    const [alias] = await db
      .insert(bottleAliases)
      .values({
        name: "invalid-pair alias",
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        assignedByActorId: actor.id,
      })
      .returning();
    await db.insert(reviews).values({
      externalSiteId: site.id,
      name: "invalid-pair review",
      bottleId: otherBottle.id,
      releaseId: mapping.releaseId,
      rating: 80,
      issue: "invalid",
      url: "https://example.test/invalid-pair/review",
    });
    if (!alias) throw new Error("Unable to create alias fixture.");

    await expectConsumerError(run(), {
      code: "invalid_pair",
      slot: "review",
    });

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toEqual(alias);
  });

  async function expectCollision(
    fixtures: typeof Fixtures,
    slot: "tasting" | "collection_bottle" | "flight_bottle",
    insert: (mapping: CatalogMigrationConsumerMapping) => Promise<void>,
  ) {
    const { mapping, parent } = await createPromotedFamily(
      fixtures,
      `collision-${slot}`,
    );
    const actor = await getUserActor(await fixtures.User());
    const [alias] = await db
      .insert(bottleAliases)
      .values({
        name: `collision-${slot} alias`,
        bottleId: parent.id,
        releaseId: mapping.releaseId,
        assignedByActorId: actor.id,
      })
      .returning();
    await insert(mapping);
    if (!alias) throw new Error("Unable to create collision alias.");

    await expectConsumerError(run(), {
      code: "membership_conflict",
      slot,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toEqual(alias);
  }

  test("aborts before mutation on a tasting final-key collision", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const createdAt = new Date("2024-03-04T05:06:07.000Z");
    await expectCollision(fixtures, "tasting", async (mapping) => {
      await db.insert(tastings).values([
        {
          bottleId: mapping.legacyParentBottleId,
          releaseId: mapping.releaseId,
          createdById: user.id,
          createdAt,
        },
        {
          bottleId: mapping.promotedBottleId,
          releaseId: null,
          createdById: user.id,
          createdAt,
        },
      ]);
    });
  });

  test("aborts before mutation on a collection final-key collision", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const collection = await fixtures.Collection({
      name: "collision collection",
      createdById: user.id,
    });
    await expectCollision(fixtures, "collection_bottle", async (mapping) => {
      await db.insert(collectionBottles).values([
        {
          collectionId: collection.id,
          bottleId: mapping.legacyParentBottleId,
          releaseId: mapping.releaseId,
        },
        {
          collectionId: collection.id,
          bottleId: mapping.promotedBottleId,
          releaseId: null,
        },
      ]);
    });
  });

  test("aborts before mutation on a Flight final-key collision", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const flight = await fixtures.Flight({
      name: "collision flight",
      createdById: user.id,
    });
    await expectCollision(fixtures, "flight_bottle", async (mapping) => {
      await db.insert(flightBottles).values([
        {
          flightId: flight.id,
          bottleId: mapping.legacyParentBottleId,
          releaseId: mapping.releaseId,
        },
        {
          flightId: flight.id,
          bottleId: mapping.promotedBottleId,
          releaseId: null,
        },
      ]);
    });
  });

  test("validates the durable promotion state", async ({ fixtures }) => {
    const { mapping, parent } = await createPromotedFamily(fixtures, "mapping");

    await db
      .update(bottleReleasePromotions)
      .set({ status: "pending", completedAt: null })
      .where(eq(bottleReleasePromotions.releaseId, mapping.releaseId));
    await expectConsumerError(run(), {
      code: "promotion_incomplete",
    });

    await db
      .update(bottleReleasePromotions)
      .set({
        status: "promoted",
        completedAt: new Date("2024-01-01T00:01:00.000Z"),
        promotedBottleId: parent.id,
      })
      .where(eq(bottleReleasePromotions.releaseId, mapping.releaseId));
    await expectConsumerError(run(), {
      code: "promotion_mismatch",
    });
  });

  test("rejects a release without a completed promotion", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const actor = await getUserActor(await fixtures.User());
    await db.insert(bottleAliases).values({
      name: "unmapped release alias",
      bottleId: parent.id,
      releaseId: release.id,
      assignedByActorId: actor.id,
    });

    await expectConsumerError(run(), {
      code: "promotion_incomplete",
      slot: null,
    });
  });
});
