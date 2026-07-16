import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq } from "drizzle-orm";
import {
  BottleStatsIntegrityError,
  recomputeBottleStats,
  recomputeBottleStatsInTransaction,
} from "./recomputeBottleStats";

async function loadTargets(groupId: number) {
  const targets = await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId));
  const genericTarget = targets.find(({ bottleId }) => bottleId === null);
  if (!genericTarget) throw new Error("Missing generic target fixture");
  return {
    exactTargetByBottleId: new Map(
      targets.flatMap((target) =>
        target.bottleId === null ? [] : ([[target.bottleId, target]] as const),
      ),
    ),
    genericTarget,
  };
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
  const [target] = await db
    .insert(catalogTargets)
    .values({ groupId: source.groupId as number, bottleId: bottle.id })
    .returning();
  if (!target) throw new Error("Unable to create exact target fixture");
  return { bottle, target };
}

async function createTasting({
  bottleId,
  targetId,
  rating,
  createdById,
  sequence,
}: {
  bottleId: number;
  targetId: number | null;
  rating: number | null;
  createdById: number;
  sequence: number;
}) {
  await db.insert(tastings).values({
    bottleId,
    targetId,
    rating,
    createdById,
    createdAt: new Date(Date.UTC(2026, 0, 2, 0, 0, sequence)),
  });
}

describe("exact Bottle statistics recomputation", () => {
  test("counts only exact target activity and leaves its group unchanged", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const sibling = await createMember(bottle, "Exact Stats Sibling");
    const unrelated = await fixtures.Bottle();
    const targets = await loadTargets(bottle.groupId as number);
    const unrelatedTargets = await loadTargets(unrelated.groupId as number);
    const exactTarget = targets.exactTargetByBottleId.get(bottle.id);
    const unrelatedTarget = unrelatedTargets.exactTargetByBottleId.get(
      unrelated.id,
    );
    if (!exactTarget || !unrelatedTarget) {
      throw new Error("Missing exact target fixture");
    }

    for (const [sequence, rating] of [
      SIMPLE_RATING_VALUES.PASS,
      SIMPLE_RATING_VALUES.SIP,
      SIMPLE_RATING_VALUES.SAVOR,
      null,
    ].entries()) {
      await createTasting({
        bottleId: bottle.id,
        targetId: exactTarget.id,
        rating,
        createdById: defaults.user.id,
        sequence,
      });
    }
    await createTasting({
      bottleId: bottle.id,
      targetId: targets.genericTarget.id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 10,
    });
    await createTasting({
      bottleId: bottle.id,
      targetId: sibling.target.id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 11,
    });
    await createTasting({
      bottleId: bottle.id,
      targetId: unrelatedTarget.id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 12,
    });
    await createTasting({
      bottleId: bottle.id,
      targetId: null,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 13,
    });
    await db
      .update(bottles)
      .set({ totalTastings: 99, avgRating: 99 })
      .where(eq(bottles.id, bottle.id));
    const groupBefore = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId as number),
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
      totalTastings: 4,
      avgRating: expectedAverage,
      ratingStats: {
        pass: 1,
        sip: 1,
        savor: 1,
        total: 3,
        avg: expectedAverage,
      },
    });
    expect(firstResult.ratingStats.percentage.pass).toBeCloseTo(100 / 3, 12);
    expect(firstResult.ratingStats.percentage.sip).toBeCloseTo(100 / 3, 12);
    expect(firstResult.ratingStats.percentage.savor).toBeCloseTo(100 / 3, 12);
    expect(secondResult).toMatchObject({
      totalTastings: firstResult.totalTastings,
      avgRating: firstResult.avgRating,
      ratingStats: firstResult.ratingStats,
    });
    const persistedBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });
    expect(persistedBottle).toMatchObject({
      id: bottle.id,
      groupId: bottle.groupId,
      totalTastings: 4,
      avgRating: expectedAverage,
      ratingStats: {
        pass: 1,
        sip: 1,
        savor: 1,
        total: 3,
        avg: expectedAverage,
      },
    });
    expect(persistedBottle?.ratingStats.percentage.pass).toBeCloseTo(
      100 / 3,
      12,
    );
    expect(persistedBottle?.ratingStats.percentage.sip).toBeCloseTo(
      100 / 3,
      12,
    );
    expect(persistedBottle?.ratingStats.percentage.savor).toBeCloseTo(
      100 / 3,
      12,
    );
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, bottle.groupId as number),
      }),
    ).toEqual(groupBefore);
  });

  test("persists empty and unrated exact target statistics", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targets = await loadTargets(bottle.groupId as number);
    const exactTarget = targets.exactTargetByBottleId.get(bottle.id);
    if (!exactTarget) throw new Error("Missing exact target fixture");

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      totalTastings: 0,
      avgRating: null,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
    });

    await createTasting({
      bottleId: bottle.id,
      targetId: exactTarget.id,
      rating: null,
      createdById: defaults.user.id,
      sequence: 1,
    });
    await createTasting({
      bottleId: bottle.id,
      targetId: exactTarget.id,
      rating: null,
      createdById: defaults.user.id,
      sequence: 2,
    });

    await expect(recomputeBottleStats(bottle.id)).resolves.toMatchObject({
      totalTastings: 2,
      avgRating: null,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({
      id: bottle.id,
      groupId: bottle.groupId,
      totalTastings: 2,
      avgRating: null,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
    });
  });

  test("rejects a Bottle in a tombstoned group without mutation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ totalTastings: 17 });
    const destination = await fixtures.Bottle();
    await db.insert(bottleGroupTombstones).values({
      groupId: bottle.groupId as number,
      newGroupId: destination.groupId as number,
      createdByActorId: bottle.createdByActorId,
    });
    const before = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });

    const error = await waitError(recomputeBottleStats(bottle.id));

    expect(error).toBeInstanceOf(BottleStatsIntegrityError);
    expect(error).toMatchObject({
      code: "invalid_catalog_graph",
      bottleId: bottle.id,
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toEqual(before);
  });

  test("rejects missing, retired, unmigrated, and invalid exact graphs without mutation", async ({
    fixtures,
  }) => {
    const missingId = 9_999_991;
    const missingError = await waitError(recomputeBottleStats(missingId));
    expect(missingError).toBeInstanceOf(BottleStatsIntegrityError);
    expect(missingError).toMatchObject({
      code: "not_found",
      bottleId: missingId,
    });

    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    const retiredBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, retired.id),
    });
    const retiredError = await waitError(recomputeBottleStats(retired.id));
    expect(retiredError).toBeInstanceOf(BottleStatsIntegrityError);
    expect(retiredError).toMatchObject({
      code: "retired",
      bottleId: retired.id,
    });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, retired.id) }),
    ).toEqual(retiredBefore);

    const unmigrated = await fixtures.LegacyBottle();
    const unmigratedBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, unmigrated.id),
    });
    const unmigratedError = await waitError(
      recomputeBottleStats(unmigrated.id),
    );
    expect(unmigratedError).toBeInstanceOf(BottleStatsIntegrityError);
    expect(unmigratedError).toMatchObject({
      code: "unmigrated",
      bottleId: unmigrated.id,
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, unmigrated.id),
      }),
    ).toEqual(unmigratedBefore);

    const invalid = await fixtures.Bottle({ totalTastings: 17 });
    const [exactTarget] = await db
      .select()
      .from(catalogTargets)
      .where(
        and(
          eq(catalogTargets.groupId, invalid.groupId as number),
          eq(catalogTargets.bottleId, invalid.id),
        ),
      );
    if (!exactTarget) throw new Error("Missing exact target fixture");
    await db
      .update(bottleAliases)
      .set({ targetId: null })
      .where(eq(bottleAliases.targetId, exactTarget.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.id, exactTarget.id));
    const invalidBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, invalid.id),
    });

    const invalidError = await waitError(recomputeBottleStats(invalid.id));
    expect(invalidError).toBeInstanceOf(BottleStatsIntegrityError);
    expect(invalidError).toMatchObject({
      code: "invalid_catalog_graph",
      bottleId: invalid.id,
    });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, invalid.id) }),
    ).toEqual(invalidBefore);
  });
});
