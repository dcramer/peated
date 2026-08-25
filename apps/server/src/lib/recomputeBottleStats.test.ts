import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import {
  BottleStatsIntegrityError,
  recomputeBottleStats,
  recomputeBottleStatsInTransaction,
} from "./recomputeBottleStats";

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
    createdAt: new Date(Date.UTC(2026, 0, 2, 0, 0, sequence)),
  });
}

describe("Bottle statistics recomputation", () => {
  test("counts raw activity assigned directly to only the Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const unrelated = await fixtures.Bottle();

    for (const [sequence, rating] of [
      SIMPLE_RATING_VALUES.PASS,
      SIMPLE_RATING_VALUES.SIP,
      SIMPLE_RATING_VALUES.SAVOR,
      null,
    ].entries()) {
      await createTasting(bottle.id, defaults.user.id, rating, sequence);
    }
    await createTasting(bottle.id, defaults.user.id, null, 4, 84);
    await createTasting(bottle.id, defaults.user.id, null, 5, 88);
    await createTasting(
      unrelated.id,
      defaults.user.id,
      SIMPLE_RATING_VALUES.SAVOR,
      10,
    );
    await createTasting(unrelated.id, defaults.user.id, null, 11, 99);
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId),
    });

    const firstResult = await recomputeBottleStats(bottle.id);
    const secondResult = await db.transaction((tx) =>
      recomputeBottleStatsInTransaction(tx, bottle.id),
    );

    const expectedAverage =
      (SIMPLE_RATING_VALUES.PASS +
        SIMPLE_RATING_VALUES.SIP +
        SIMPLE_RATING_VALUES.SAVOR) /
      3;
    expect(firstResult).toMatchObject({
      id: bottle.id,
      groupId: bottle.groupId,
      totalTastings: 6,
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
      totalTastings: firstResult.totalTastings,
      avgRating: firstResult.avgRating,
      avgScore: firstResult.avgScore,
      totalScores: firstResult.totalScores,
      ratingStats: firstResult.ratingStats,
    });
    await expect(
      db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).resolves.toMatchObject(secondResult);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, bottle.groupId),
      }),
    ).toEqual(groupBefore);
  });

  test("persists empty and unrated direct statistics", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      totalTastings: 0,
      avgRating: null,
      avgScore: null,
      totalScores: 0,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
    });

    await createTasting(bottle.id, defaults.user.id, null, 1);
    await createTasting(bottle.id, defaults.user.id, null, 2);

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      totalTastings: 2,
      avgRating: null,
      avgScore: null,
      totalScores: 0,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
      },
    });
  });

  test("rejects missing, retired, and unmigrated Bottles", async ({
    fixtures,
  }) => {
    const missingId = 9_999_991;
    await expect(recomputeBottleStats(missingId)).rejects.toMatchObject({
      name: "BottleStatsIntegrityError",
      code: "not_found",
      bottleId: missingId,
    });

    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    await expect(recomputeBottleStats(retired.id)).rejects.toMatchObject({
      code: "retired",
      bottleId: retired.id,
    });

    const unmigrated = await fixtures.LegacyBottle();
    await expect(recomputeBottleStats(unmigrated.id)).rejects.toMatchObject({
      code: "unmigrated",
      bottleId: unmigrated.id,
    });
  });
});
