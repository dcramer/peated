import { db } from "@peated/server/db";
import {
  badgeAwards,
  badgeAwardTrackedObjects,
  bottleTombstones,
  tastings,
  users,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { awardAllBadgeXp, rescanBadge } from ".";

describe("direct-Bottle badge awarding", () => {
  test("live award checks and tracks the Tasting Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "everyTasting", config: {} }],
    });
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });

    expect(await awardAllBadgeXp(db, tasting)).toHaveLength(1);
    expect(
      await db
        .select({
          objectType: badgeAwardTrackedObjects.objectType,
          objectId: badgeAwardTrackedObjects.objectId,
        })
        .from(badgeAwardTrackedObjects),
    ).toEqual([{ objectType: "bottle", objectId: bottle.id }]);
  });

  test("rescan uses direct Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const badge = await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "everyTasting", config: {} }],
    });
    await fixtures.Tasting({ bottleId: bottle.id });
    await fixtures.Tasting({ bottleId: bottle.id });

    await rescanBadge(badge);

    expect(
      await db
        .select({ id: badgeAwards.id })
        .from(badgeAwards)
        .where(eq(badgeAwards.badgeId, badge.id)),
    ).toHaveLength(2);
  });

  test("rescans across the ascending-id batch boundary", async ({
    fixtures,
  }) => {
    const badge = await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "everyTasting", config: {} }],
    });
    const bottle = await fixtures.Bottle();
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
        createdById: id,
        createdAt: new Date(startedAt + index),
      })),
    );

    await rescanBadge(badge);

    expect(
      await db
        .select({ id: badgeAwards.id })
        .from(badgeAwards)
        .where(eq(badgeAwards.badgeId, badge.id)),
    ).toHaveLength(201);
  });

  test("fails closed when a Tasting Bottle is retired", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });

    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });
    await expect(awardAllBadgeXp(db, tasting)).rejects.toThrow(
      `references inactive Bottle ${bottle.id}`,
    );
  });
});
