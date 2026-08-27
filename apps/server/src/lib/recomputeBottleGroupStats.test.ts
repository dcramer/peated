import type { TastingBandId } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  memberReviews,
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
  ratingBand: TastingBandId | null,
  sequence: number,
) {
  await db.insert(tastings).values({
    bottleId,
    ratingBand,
    createdById,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
  });
}

describe("BottleGroup statistics recomputation", () => {
  test("counts active member Bottles once", async ({ defaults, fixtures }) => {
    const first = await fixtures.Bottle();
    const second = await createMember(first, "Aggregate Member Two");
    const unrelated = await fixtures.Bottle();

    await createTasting(first.id, defaults.user.id, "good", 1);
    await createTasting(first.id, defaults.user.id, "outstanding", 2);
    await createTasting(second.id, defaults.user.id, "unicorn", 3);
    await createTasting(unrelated.id, defaults.user.id, "unicorn", 4);
    for (let index = 0; index < 20; index += 1) {
      const member = index === 0 ? defaults.user : await fixtures.User();
      await db.insert(memberReviews).values({
        bottleId: index % 2 === 0 ? first.id : second.id,
        createdById: member.id,
        score: 75 + index,
      });
    }

    const firstResult = await db.transaction((tx) =>
      recomputeBottleGroupStatsInTransaction(tx, requireGroupId(first.groupId)),
    );
    const secondResult = await recomputeBottleGroupStats(
      requireGroupId(first.groupId),
    );

    expect(firstResult).toMatchObject({
      id: first.groupId,
      totalBottles: 2,
      totalTastings: 3,
      medianScore: 84,
      minScore: 75,
      maxScore: 94,
      memberScoreCount: 20,
      externalScoreCount: 0,
      tastingBandCounts: {
        mediocre: 0,
        good: 1,
        very_good: 0,
        outstanding: 1,
        unicorn: 1,
      },
    });
    const { updatedAt: _firstUpdatedAt, ...firstStats } = firstResult;
    expect(secondResult).toMatchObject(firstStats);
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
    await createTasting(retired.id, defaults.user.id, "unicorn", 2);

    await expect(
      recomputeBottleGroupStats(requireGroupId(active.groupId)),
    ).resolves.toMatchObject({
      totalBottles: 1,
      totalTastings: 1,
      memberScoreCount: 0,
      externalScoreCount: 0,
      tastingBandCounts: { unicorn: 0 },
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
