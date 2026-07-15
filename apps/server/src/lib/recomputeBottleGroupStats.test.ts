import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle, CatalogTarget } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq } from "drizzle-orm";
import {
  BottleGroupStatsIntegrityError,
  recomputeBottleGroupStatsInTransaction,
} from "./recomputeBottleGroupStats";

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

async function createMember(
  source: Bottle,
  name: string,
): Promise<{ bottle: Bottle; target: CatalogTarget }> {
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
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
  });
}

describe("recomputeBottleGroupStatsInTransaction", () => {
  test("counts generic and member exact targets once and is idempotent", async ({
    defaults,
    fixtures,
  }) => {
    const first = await fixtures.Bottle();
    const second = await createMember(first, "Aggregate Member Two");
    const unrelated = await fixtures.Bottle();
    const firstTargets = await loadTargets(first.groupId as number);
    const unrelatedTargets = await loadTargets(unrelated.groupId as number);
    const firstExactTarget = firstTargets.exactTargetByBottleId.get(first.id);
    const unrelatedExactTarget = unrelatedTargets.exactTargetByBottleId.get(
      unrelated.id,
    );
    if (!firstExactTarget || !unrelatedExactTarget) {
      throw new Error("Missing exact target fixture");
    }

    await createTasting({
      bottleId: first.id,
      targetId: firstTargets.genericTarget.id,
      rating: SIMPLE_RATING_VALUES.PASS,
      createdById: defaults.user.id,
      sequence: 1,
    });
    await createTasting({
      bottleId: first.id,
      targetId: firstExactTarget.id,
      rating: SIMPLE_RATING_VALUES.SIP,
      createdById: defaults.user.id,
      sequence: 2,
    });
    await createTasting({
      bottleId: second.bottle.id,
      targetId: second.target.id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 3,
    });
    await createTasting({
      bottleId: unrelated.id,
      targetId: unrelatedExactTarget.id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 4,
    });
    await createTasting({
      bottleId: first.id,
      targetId: null,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      createdById: defaults.user.id,
      sequence: 5,
    });
    await db
      .update(bottleGroups)
      .set({ totalBottles: 99, totalTastings: 99, avgRating: 99 })
      .where(eq(bottleGroups.id, first.groupId as number));

    const firstResult = await db.transaction((tx) =>
      recomputeBottleGroupStatsInTransaction(tx, first.groupId as number),
    );
    const secondResult = await db.transaction((tx) =>
      recomputeBottleGroupStatsInTransaction(tx, first.groupId as number),
    );

    const expectedAverage =
      (SIMPLE_RATING_VALUES.PASS +
        SIMPLE_RATING_VALUES.SIP +
        SIMPLE_RATING_VALUES.SAVOR) /
      3;
    expect(firstResult).toMatchObject({
      id: first.groupId,
      totalBottles: 2,
      totalTastings: 3,
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
      totalBottles: firstResult.totalBottles,
      totalTastings: firstResult.totalTastings,
      avgRating: firstResult.avgRating,
      ratingStats: firstResult.ratingStats,
    });

    const [persisted] = await db
      .select({
        totalBottles: bottleGroups.totalBottles,
        totalTastings: bottleGroups.totalTastings,
        avgRating: bottleGroups.avgRating,
        ratingStats: bottleGroups.ratingStats,
      })
      .from(bottleGroups)
      .where(eq(bottleGroups.id, first.groupId as number));
    expect(persisted).toMatchObject({
      totalBottles: 2,
      totalTastings: 3,
      avgRating: expectedAverage,
      ratingStats: firstResult.ratingStats,
    });
  });

  test("counts unrated targeted tastings without inventing rating percentages", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targets = await loadTargets(bottle.groupId as number);
    const exactTarget = targets.exactTargetByBottleId.get(bottle.id);
    if (!exactTarget) throw new Error("Missing exact target fixture");

    await createTasting({
      bottleId: bottle.id,
      targetId: targets.genericTarget.id,
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

    const result = await db.transaction((tx) =>
      recomputeBottleGroupStatsInTransaction(tx, bottle.groupId as number),
    );

    expect(result).toMatchObject({
      totalBottles: 1,
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

  test("rejects missing and invalid active group graphs", async ({
    fixtures,
  }) => {
    const missingError = await waitError(
      db.transaction((tx) =>
        recomputeBottleGroupStatsInTransaction(tx, 999_999),
      ),
    );
    expect(missingError).toBeInstanceOf(BottleGroupStatsIntegrityError);
    expect(missingError).toMatchObject({ code: "not_found", groupId: 999_999 });

    const bottle = await fixtures.Bottle();
    const [exactTarget] = await db
      .select()
      .from(catalogTargets)
      .where(
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          eq(catalogTargets.bottleId, bottle.id),
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

    const invalidError = await waitError(
      db.transaction((tx) =>
        recomputeBottleGroupStatsInTransaction(tx, bottle.groupId as number),
      ),
    );
    expect(invalidError).toBeInstanceOf(BottleGroupStatsIntegrityError);
    expect(invalidError).toMatchObject({
      code: "invalid_catalog_graph",
      groupId: bottle.groupId,
    });

    const destination = await fixtures.Bottle();
    const retiredGroupId = 999_998;
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupId,
      newGroupId: destination.groupId as number,
      createdByActorId: destination.createdByActorId,
    });
    const retiredError = await waitError(
      db.transaction((tx) =>
        recomputeBottleGroupStatsInTransaction(tx, retiredGroupId),
      ),
    );
    expect(retiredError).toBeInstanceOf(BottleGroupStatsIntegrityError);
    expect(retiredError).toMatchObject({
      code: "retired",
      groupId: retiredGroupId,
    });
  });
});
