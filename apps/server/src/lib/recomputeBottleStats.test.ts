import type { TastingBandId } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  recomputeBottleStats,
  recomputeBottleStatsInTransaction,
} from "./recomputeBottleStats";

async function createTasting(
  bottleId: number,
  createdById: number,
  ratingBand: TastingBandId | null,
  sequence: number,
) {
  await db.insert(tastings).values({
    bottleId,
    ratingBand,
    createdById,
    createdAt: new Date(Date.UTC(2026, 0, 2, 0, 0, sequence)),
  });
}

describe("Bottle statistics recomputation", () => {
  test("counts direct tasting bands and publishes 20 member scores", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const unrelated = await fixtures.Bottle();

    const tastingBands = [
      "mediocre",
      "good",
      "outstanding",
      null,
    ] satisfies (TastingBandId | null)[];
    for (const [sequence, band] of tastingBands.entries()) {
      await createTasting(bottle.id, defaults.user.id, band, sequence);
    }
    await createTasting(unrelated.id, defaults.user.id, "unicorn", 10);

    for (let index = 0; index < 20; index += 1) {
      const member = index === 0 ? defaults.user : await fixtures.User();
      await db.insert(memberReviews).values({
        bottleId: bottle.id,
        createdById: member.id,
        score: 80 + index,
      });
    }
    await db.insert(memberReviews).values({
      bottleId: unrelated.id,
      createdById: defaults.user.id,
      score: 100,
    });
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId),
    });

    const firstResult = await recomputeBottleStats(bottle.id);
    const secondResult = await db.transaction((tx) =>
      recomputeBottleStatsInTransaction(tx, bottle.id),
    );

    expect(firstResult).toMatchObject({
      id: bottle.id,
      groupId: bottle.groupId,
      totalTastings: 4,
      medianScore: 89,
      minScore: 80,
      maxScore: 99,
      memberScoreCount: 20,
      externalScoreCount: 0,
      tastingBandCounts: {
        mediocre: 1,
        good: 1,
        very_good: 0,
        outstanding: 1,
        unicorn: 0,
      },
    });
    const { updatedAt: _firstUpdatedAt, ...firstStats } = firstResult;
    expect(secondResult).toMatchObject(firstStats);
    await expect(
      db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).resolves.toMatchObject(secondResult);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, bottle.groupId),
      }),
    ).toEqual(groupBefore);
  });

  test("hides the range and median below 20 scores", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await createTasting(bottle.id, defaults.user.id, null, 1);
    await db.insert(memberReviews).values({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      score: 92,
    });

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      totalTastings: 1,
      medianScore: null,
      minScore: null,
      maxScore: null,
      memberScoreCount: 1,
      externalScoreCount: 0,
    });
  });

  test("counts only permitted public whole-number external scores", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const allowedSite = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const blockedSite = await fixtures.ExternalSite({ type: "whiskyfun" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: allowedSite.id,
    });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: blockedSite.id,
      allowScoreDisplay: false,
    });

    for (const [site, value, scale, hidden] of [
      [allowedSite, 90, 100, false],
      [allowedSite, 91.5, 100, false],
      [allowedSite, 9, 10, false],
      [allowedSite, 92, 100, true],
      [blockedSite, 93, 100, false],
    ] as const) {
      await fixtures.ExternalReview({
        externalSiteId: site.id,
        bottleId: bottle.id,
        hidden,
        nativeScoreValue: value,
        nativeScoreScale: scale,
        nativeScoreDisplay: `${value}/${scale}`,
      });
    }
    await fixtures.ExternalReview({
      externalSiteId: allowedSite.id,
      bottleId: bottle.id,
      hidden: false,
      nativeScoreValue: null,
      nativeScoreScale: null,
      legacyNormalizedScore: 99,
    });

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      memberScoreCount: 0,
      externalScoreCount: 1,
      medianScore: null,
    });
  });

  test("uses member and external scores together at the publication floor", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    for (let index = 0; index < 19; index += 1) {
      const member = index === 0 ? defaults.user : await fixtures.User();
      await db.insert(memberReviews).values({
        bottleId: bottle.id,
        createdById: member.id,
        score: 80 + index,
      });
    }
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
    });
    await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      hidden: false,
      nativeScoreValue: 100,
      nativeScoreScale: 100,
      nativeScoreDisplay: "100/100",
    });

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      memberScoreCount: 19,
      externalScoreCount: 1,
      medianScore: 89,
      minScore: 80,
      maxScore: 100,
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
