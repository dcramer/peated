import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import {
  BottleGroupStatsIntegrityError,
  recomputeBottleGroupStats,
  recomputeBottleGroupStatsInTransaction,
} from "./recomputeBottleGroupStats";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

async function createMember(source: Bottle, name: string) {
  const [bottle] = await db
    .insert(bottles)
    .values({
      groupId: source.groupId,
      name,
      fullName: name,
      brandId: source.brandId,
      createdByActorId: source.createdByActorId,
    })
    .returning();
  if (!bottle) throw new Error("Unable to create member Bottle fixture");
  return bottle;
}

async function createTasting(
  bottleId: number,
  createdById: number,
  rating: number | null,
  sequence: number,
  score: number | null = null,
) {
  await db.insert(tastings).values({
    bottleId,
    rating,
    score,
    createdById,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
  });
}

describe("BottleGroup statistics recomputation", () => {
  test("counts raw activity across active member Bottles once", async ({
    defaults,
    fixtures,
  }) => {
    const first = await fixtures.Bottle();
    const second = await createMember(first, "Aggregate Member Two");
    const unrelated = await fixtures.Bottle();

    await createTasting(
      first.id,
      defaults.user.id,
      SIMPLE_RATING_VALUES.PASS,
      1,
    );
    await createTasting(
      first.id,
      defaults.user.id,
      SIMPLE_RATING_VALUES.SIP,
      2,
    );
    await createTasting(
      second.id,
      defaults.user.id,
      SIMPLE_RATING_VALUES.SAVOR,
      3,
    );
    await createTasting(
      unrelated.id,
      defaults.user.id,
      SIMPLE_RATING_VALUES.SAVOR,
      4,
    );
    await createTasting(first.id, defaults.user.id, null, 5, 84);
    await createTasting(second.id, defaults.user.id, null, 6, 88);
    await createTasting(unrelated.id, defaults.user.id, null, 7, 99);

    const firstResult = await db.transaction((tx) =>
      recomputeBottleGroupStatsInTransaction(tx, requireGroupId(first.groupId)),
    );
    const secondResult = await recomputeBottleGroupStats(
      requireGroupId(first.groupId),
    );

    const expectedAverage =
      (SIMPLE_RATING_VALUES.PASS +
        SIMPLE_RATING_VALUES.SIP +
        SIMPLE_RATING_VALUES.SAVOR) /
      3;
    expect(firstResult).toMatchObject({
      id: first.groupId,
      totalBottles: 2,
      totalTastings: 5,
      avgRating: expectedAverage,
      avgScore: 86,
      totalScores: 2,
      ratingStats: {
        pass: 1,
        sip: 1,
        savor: 1,
        total: 3,
        avg: expectedAverage,
      },
    });
    expect(firstResult.ratingStats.percentage.pass).toBeCloseTo(100 / 3, 12);
    expect(secondResult).toMatchObject({
      totalBottles: firstResult.totalBottles,
      totalTastings: firstResult.totalTastings,
      avgRating: firstResult.avgRating,
      avgScore: firstResult.avgScore,
      totalScores: firstResult.totalScores,
      ratingStats: firstResult.ratingStats,
    });
  });

  test("excludes retired members and their activity", async ({
    defaults,
    fixtures,
  }) => {
    const active = await fixtures.Bottle();
    const retired = await createMember(active, "Retired Aggregate Member");
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    await createTasting(active.id, defaults.user.id, null, 1);
    await createTasting(
      retired.id,
      defaults.user.id,
      SIMPLE_RATING_VALUES.SAVOR,
      2,
    );

    await expect(
      recomputeBottleGroupStats(requireGroupId(active.groupId)),
    ).resolves.toMatchObject({
      totalBottles: 1,
      totalTastings: 1,
      avgRating: null,
      avgScore: null,
      totalScores: 0,
      ratingStats: {
        total: 0,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
    });
  });

  test("rejects missing groups and groups without active members", async ({
    fixtures,
  }) => {
    const missingError = await waitError(recomputeBottleGroupStats(999_999));
    expect(missingError).toBeInstanceOf(BottleGroupStatsIntegrityError);
    expect(missingError).toMatchObject({ code: "not_found", groupId: 999_999 });

    const destination = await fixtures.Bottle();
    const onlyMember = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: onlyMember.id,
      newBottleId: destination.id,
    });
    const before = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, requireGroupId(onlyMember.groupId)),
    });
    await expect(
      recomputeBottleGroupStats(requireGroupId(onlyMember.groupId)),
    ).rejects.toMatchObject({
      code: "invalid_catalog_graph",
      groupId: onlyMember.groupId,
    });
    await expect(
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, requireGroupId(onlyMember.groupId)),
      }),
    ).resolves.toEqual(before);
  });
});
