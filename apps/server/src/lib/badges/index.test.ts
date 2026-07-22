import { db } from "@peated/server/db";
import {
  badgeAwards,
  badgeAwardTrackedObjects,
  bottleGroups,
  bottleTombstones,
  catalogTargets,
  tastingBadgeAwards,
  tastings,
  users,
} from "@peated/server/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { awardAllBadgeXp, rescanBadge } from ".";
import {
  createTastingForBadge,
  getPersistedBadgeTasting,
  useGenericBadgeTarget,
} from "./testHelpers";

describe("rescanBadge", () => {
  test("live award records retained-pair drift without changing Tasting identity", async ({
    fixtures,
  }) => {
    const targetBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    const badge = await fixtures.Badge({
      tracker: "bottle",
      checks: [
        {
          type: "bottle",
          config: { bottle: [targetBottle.id] },
        },
      ],
    });
    const tasting = await fixtures.Tasting({ bottleId: targetBottle.id });
    const [driftedTasting] = await db
      .update(tastings)
      .set({ bottleId: retainedBottle.id })
      .where(eq(tastings.id, tasting.id))
      .returning();
    if (!driftedTasting) throw new Error("Unable to drift Tasting fixture");
    const persistedBefore = {
      bottleId: driftedTasting.bottleId,
      releaseId: driftedTasting.releaseId,
      targetId: driftedTasting.targetId,
    };
    expect(await awardAllBadgeXp(db, driftedTasting)).toHaveLength(1);

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
    ).toEqual(persistedBefore);
    expect(
      await db
        .select({
          objectType: badgeAwardTrackedObjects.objectType,
          objectId: badgeAwardTrackedObjects.objectId,
        })
        .from(badgeAwardTrackedObjects),
    ).toEqual([{ objectType: "bottle", objectId: targetBottle.id }]);
  });

  test("rescan records retained-pair drift without changing Tasting identity", async ({
    fixtures,
  }) => {
    const targetBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    const badge = await fixtures.Badge({
      tracker: "bottle",
      checks: [
        {
          type: "bottle",
          config: { bottle: [targetBottle.id] },
        },
      ],
    });
    const tasting = await fixtures.Tasting({ bottleId: targetBottle.id });
    const [driftedTasting] = await db
      .update(tastings)
      .set({ bottleId: retainedBottle.id })
      .where(eq(tastings.id, tasting.id))
      .returning();
    if (!driftedTasting) throw new Error("Unable to drift Tasting fixture");
    const persistedBefore = {
      bottleId: driftedTasting.bottleId,
      releaseId: driftedTasting.releaseId,
      targetId: driftedTasting.targetId,
    };
    await rescanBadge(badge);

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
    ).toEqual(persistedBefore);
    expect(
      await db
        .select({
          objectType: badgeAwardTrackedObjects.objectType,
          objectId: badgeAwardTrackedObjects.objectId,
        })
        .from(badgeAwardTrackedObjects),
    ).toEqual([{ objectType: "bottle", objectId: targetBottle.id }]);
  });

  test("rescans age with new tastings", async ({ fixtures }) => {
    const badge = await fixtures.Badge({
      checks: [
        {
          type: "age",
          config: {
            minAge: 5,
            maxAge: 5,
          },
        },
      ],
    });

    const user1 = await fixtures.User();
    await fixtures.Tasting({
      bottleId: (
        await fixtures.Bottle({
          name: "A",
          statedAge: 5,
        })
      ).id,
      createdById: user1.id,
    });

    const user2 = await fixtures.User();
    await fixtures.Tasting({
      bottleId: (
        await fixtures.Bottle({
          name: "B",
          statedAge: 12,
        })
      ).id,
      createdById: user2.id,
    });

    await rescanBadge(badge);

    const awardList = await db.select().from(badgeAwards);
    expect(awardList.length).toEqual(1);
    expect(awardList[0].level).toEqual(0);
    expect(awardList[0].xp).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);
    expect(awardList[0].userId).toEqual(user1.id);

    const tastingAwardList = await db.select().from(tastingBadgeAwards);
    expect(tastingAwardList.length).toEqual(0);
  });

  test("rescans age with existing tastings", async ({ fixtures }) => {
    const badge = await fixtures.Badge({
      checks: [
        {
          type: "age",
          config: {
            minAge: 5,
            maxAge: 5,
          },
        },
      ],
    });

    const tasting1 = await createTastingForBadge(fixtures, {
      name: "A",
      statedAge: 5,
    });

    const initial = await awardAllBadgeXp(
      db,
      await getPersistedBadgeTasting(tasting1.id),
    );
    expect(initial.length).toEqual(1);

    await rescanBadge(badge);

    const awardList = await db.select().from(badgeAwards);
    expect(awardList.length).toEqual(1);
    expect(awardList[0].level).toEqual(0);
    expect(awardList[0].xp).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);

    const tastingAwardList = await db.select().from(tastingBadgeAwards);
    expect(tastingAwardList.length).toEqual(0);
  });

  test("live award and rescan share generic group-owned identity", async ({
    fixtures,
  }) => {
    const exactBrand = await fixtures.Entity();
    const groupBrand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({ brandId: exactBrand.id });
    if (!bottle.groupId) throw new Error("Expected a BottleGroup fixture");
    await db
      .update(bottleGroups)
      .set({ brandId: groupBrand.id })
      .where(eq(bottleGroups.id, bottle.groupId));

    const badge = await fixtures.Badge({
      tracker: "entity",
      checks: [
        {
          type: "entity",
          config: { entity: groupBrand.id, type: null },
        },
      ],
    });
    const liveUser = await fixtures.User();
    const rescanUser = await fixtures.User();
    const exactUser = await fixtures.User();
    const liveTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: liveUser.id,
    });
    const rescanTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: rescanUser.id,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: exactUser.id,
    });
    await useGenericBadgeTarget(liveTasting.id);
    await useGenericBadgeTarget(rescanTasting.id);

    expect(
      await awardAllBadgeXp(db, await getPersistedBadgeTasting(liveTasting.id)),
    ).toHaveLength(1);
    await rescanBadge(badge);

    const awards = await db
      .select()
      .from(badgeAwards)
      .where(eq(badgeAwards.badgeId, badge.id));
    expect(
      awards
        .map(({ userId, xp }) => ({ userId, xp }))
        .sort((a, b) => a.userId - b.userId),
    ).toEqual(
      [liveUser.id, rescanUser.id]
        .sort((a, b) => a - b)
        .map((userId) => ({ userId, xp: 1 })),
    );

    const tracked = await db
      .select({
        objectType: badgeAwardTrackedObjects.objectType,
        objectId: badgeAwardTrackedObjects.objectId,
      })
      .from(badgeAwardTrackedObjects);
    expect(tracked).toEqual([
      { objectType: "entity", objectId: groupBrand.id },
      { objectType: "entity", objectId: groupBrand.id },
    ]);
  });

  test("rescans across the ascending-id batch boundary", async ({
    fixtures,
  }) => {
    const badge = await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "everyTasting", config: {} }],
    });
    const bottle = await fixtures.Bottle();
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.bottleId, bottle.id),
        isNotNull(catalogTargets.bottleId),
      ),
    });
    if (!exactTarget)
      throw new Error("Expected an exact CatalogTarget fixture");

    const batchUsers = await db
      .insert(users)
      .values(
        Array.from({ length: 201 }, (_, index) => ({
          username: `badge-batch-${index}`,
          email: `badge-batch-${index}@example.com`,
          verified: true,
          termsAcceptedAt: new Date(),
        })),
      )
      .returning({ id: users.id });
    const startedAt = Date.now();
    await db.insert(tastings).values(
      batchUsers.map(({ id }, index) => ({
        bottleId: bottle.id,
        targetId: exactTarget.id,
        createdById: id,
        createdAt: new Date(startedAt + index),
      })),
    );

    await rescanBadge(badge);

    const awards = await db
      .select({ id: badgeAwards.id })
      .from(badgeAwards)
      .where(eq(badgeAwards.badgeId, badge.id));
    expect(awards).toHaveLength(201);
  });

  test("live award fails closed for a targetless Tasting", async ({
    fixtures,
  }) => {
    await fixtures.Badge();
    const tasting = await fixtures.Tasting({ targetId: null });

    await expect(awardAllBadgeXp(db, tasting)).rejects.toMatchObject({
      code: "CATALOG_TARGET_INTEGRITY_MISMATCH",
    });
  });

  test("rescan fails closed for a retired exact target", async ({
    fixtures,
  }) => {
    const badge = await fixtures.Badge();
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.Tasting({ bottleId: bottle.id });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    await expect(rescanBadge(badge)).rejects.toMatchObject({
      code: "CATALOG_TARGET_RETIRED",
    });
  });
});
