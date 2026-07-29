import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  assertCatalogMigrationStatsInTransaction,
  recomputeCatalogMigrationStatsInTransaction,
  type CatalogMigrationStatsIntegrityError,
} from "./catalogMigrationStats";

describe("catalog migration statistics", () => {
  test("recomputes parent, promoted Bottle, and group from repointed tastings", async ({
    defaults,
    fixtures,
  }) => {
    const parentUpdatedAt = new Date(Date.UTC(2020, 0, 2));
    const parent = await fixtures.Bottle({
      totalTastings: 99,
      avgRating: 99,
      updatedAt: parentUpdatedAt,
    });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId as number,
      edition: "Promoted Stats",
      totalTastings: 88,
      avgRating: 88,
      updatedAt: release.updatedAt,
    });
    const createdAt = new Date(Date.UTC(2026, 6, 1));
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, parent.groupId as number),
    });
    if (!groupBefore) throw new Error("Unable to load BottleGroup fixture");
    const graph = [
      {
        groupId: parent.groupId as number,
        retainedParentBottleId: parent.id,
        promotedBottleIds: [promoted.id],
      },
    ] as const;

    await db.insert(tastings).values([
      {
        bottleId: parent.id,
        releaseId: null,
        createdById: defaults.user.id,
        rating: SIMPLE_RATING_VALUES.PASS,
        createdAt,
      },
      {
        bottleId: parent.id,
        releaseId: release.id,
        createdById: defaults.user.id,
        rating: SIMPLE_RATING_VALUES.SIP,
        createdAt: new Date(createdAt.getTime() + 1),
      },
      {
        bottleId: parent.id,
        releaseId: release.id,
        createdById: defaults.user.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
        createdAt: new Date(createdAt.getTime() + 2),
      },
      {
        bottleId: parent.id,
        releaseId: release.id,
        createdById: defaults.user.id,
        rating: null,
        createdAt: new Date(createdAt.getTime() + 3),
      },
    ]);

    const result = await db.transaction(async (tx) => {
      await tx
        .update(tastings)
        .set({ bottleId: promoted.id })
        .where(
          and(
            eq(tastings.releaseId, release.id),
            isNotNull(tastings.releaseId),
          ),
        );
      return await recomputeCatalogMigrationStatsInTransaction(tx, graph);
    });

    expect(result).toEqual({
      bottlesRecomputed: 2,
      groupsRecomputed: 1,
    });
    const parentAfter = await db.query.bottles.findFirst({
      where: eq(bottles.id, parent.id),
    });
    expect(parentAfter).toMatchObject({
      totalTastings: 1,
      avgRating: SIMPLE_RATING_VALUES.PASS,
      ratingStats: {
        pass: 1,
        sip: 0,
        savor: 0,
        total: 1,
        avg: SIMPLE_RATING_VALUES.PASS,
        percentage: { pass: 100, sip: 0, savor: 0 },
      },
    });
    expect(parentAfter?.updatedAt).toEqual(parent.updatedAt);

    const promotedAfter = await db.query.bottles.findFirst({
      where: eq(bottles.id, promoted.id),
    });
    expect(promotedAfter).toMatchObject({
      totalTastings: 3,
      avgRating: (SIMPLE_RATING_VALUES.SIP + SIMPLE_RATING_VALUES.SAVOR) / 2,
      ratingStats: {
        pass: 0,
        sip: 1,
        savor: 1,
        total: 2,
        avg: (SIMPLE_RATING_VALUES.SIP + SIMPLE_RATING_VALUES.SAVOR) / 2,
        percentage: { pass: 0, sip: 50, savor: 50 },
      },
    });
    expect(promotedAfter?.updatedAt).toEqual(promoted.updatedAt);

    const groupAfter = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, parent.groupId as number),
    });
    expect(groupAfter).toMatchObject({
      totalBottles: 2,
      totalTastings: 4,
      avgRating:
        (SIMPLE_RATING_VALUES.PASS +
          SIMPLE_RATING_VALUES.SIP +
          SIMPLE_RATING_VALUES.SAVOR) /
        3,
      ratingStats: {
        pass: 1,
        sip: 1,
        savor: 1,
        total: 3,
        avg:
          (SIMPLE_RATING_VALUES.PASS +
            SIMPLE_RATING_VALUES.SIP +
            SIMPLE_RATING_VALUES.SAVOR) /
          3,
        percentage: {
          pass: (1 / 3) * 100,
          sip: (1 / 3) * 100,
          savor: (1 / 3) * 100,
        },
      },
    });
    expect(groupAfter?.updatedAt).toEqual(groupBefore.updatedAt);

    await expect(
      db.transaction((tx) =>
        assertCatalogMigrationStatsInTransaction(tx, graph),
      ),
    ).resolves.toEqual({
      bottlesValidated: 2,
      groupsValidated: 1,
    });
    await expect(
      Promise.all([
        db.query.bottles.findFirst({ where: eq(bottles.id, parent.id) }),
        db.query.bottles.findFirst({ where: eq(bottles.id, promoted.id) }),
        db.query.bottleGroups.findFirst({
          where: eq(bottleGroups.id, parent.groupId as number),
        }),
      ]),
    ).resolves.toEqual([parentAfter, promotedAfter, groupAfter]);
  });

  test("rejects an unexpected tombstone before changing statistics", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ totalTastings: 71 });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId as number,
      edition: "Retired Promoted Stats",
      totalTastings: 72,
    });
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: promoted.id,
      newBottleId: replacement.id,
    });

    await expect(
      db.transaction((tx) =>
        recomputeCatalogMigrationStatsInTransaction(tx, [
          {
            groupId: parent.groupId as number,
            retainedParentBottleId: parent.id,
            promotedBottleIds: [promoted.id],
          },
        ]),
      ),
    ).rejects.toMatchObject({
      name: "CatalogMigrationStatsIntegrityError",
      code: "unexpected_tombstone",
      details: { bottleId: promoted.id },
    } satisfies Partial<CatalogMigrationStatsIntegrityError>);

    await expect(
      db.query.bottles.findFirst({ where: eq(bottles.id, parent.id) }),
    ).resolves.toMatchObject({ totalTastings: 71 });
    await expect(
      db.query.bottles.findFirst({ where: eq(bottles.id, promoted.id) }),
    ).resolves.toMatchObject({ totalTastings: 72 });
  });
});
