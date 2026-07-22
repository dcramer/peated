import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function targetIds(bottleId: number, groupId: number) {
  const [exact, generic] = await Promise.all([
    db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottleId),
      columns: { id: true },
    }),
    db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, groupId),
        isNull(catalogTargets.bottleId),
      ),
      columns: { id: true },
    }),
  ]);
  if (!exact || !generic) throw new Error("Missing target fixtures");
  return { exact: exact.id, generic: generic.id };
}

describe("GET /users/:user/flavors", () => {
  test("uses authoritative targets and preserves null-rating rank", async ({
    defaults,
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const genericBottle = await fixtures.Bottle({
      flavorProfile: "spicy_dry",
    });
    const promotionParent = await fixtures.Bottle({
      flavorProfile: "young_spritely",
    });
    const release = await fixtures.BottleRelease({
      bottleId: promotionParent.id,
    });
    const targetBottle = await fixtures.Bottle({
      flavorProfile: "oily_coastal",
    });
    const retainedDriftBottle = await fixtures.Bottle({
      flavorProfile: "sweet_fruit_mellow",
    });
    const targetlessBottle = await fixtures.Bottle({
      flavorProfile: "old_dignified",
    });
    const nullFlavorBottle = await fixtures.Bottle({ flavorProfile: null });
    const nullRatingBottle = await fixtures.Bottle({
      flavorProfile: "spicy_sweet",
    });
    const [exactTargets, genericTargets, targetBottleTargets] =
      await Promise.all([
        targetIds(exactBottle.id, exactBottle.groupId!),
        targetIds(genericBottle.id, genericBottle.groupId!),
        targetIds(targetBottle.id, targetBottle.groupId!),
      ]);

    await db
      .update(bottleGroups)
      .set({ flavorProfile: "juicy_oak_vanilla" })
      .where(eq(bottleGroups.id, exactBottle.groupId!));
    await db
      .update(bottleGroups)
      .set({
        flavorProfile: "lightly_peated",
        representativeBottleId: null,
      })
      .where(eq(bottleGroups.id, genericBottle.groupId!));

    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: promotionParent.groupId,
        brandId: promotionParent.brandId,
        name: `${promotionParent.name} promoted`,
        fullName: `${promotionParent.fullName} promoted`,
        flavorProfile: "heavily_peated",
        createdByActorId: promotionParent.createdByActorId,
      })
      .returning();
    if (!promotedBottle) throw new Error("Missing promoted Bottle fixture");
    const [promotedTarget] = await db
      .insert(catalogTargets)
      .values({
        groupId: promotionParent.groupId!,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!promotedTarget) throw new Error("Missing promoted target fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: promotionParent.createdByActorId,
    });

    const driftTasting = await fixtures.Tasting({
      bottleId: retainedDriftBottle.id,
      targetId: targetBottleTargets.exact,
      rating: 1,
      createdById: defaults.user.id,
    });
    const promotedTasting = await fixtures.Tasting({
      bottleId: promotionParent.id,
      releaseId: release.id,
      targetId: promotedTarget.id,
      rating: 2,
      createdById: defaults.user.id,
    });
    const targetlessTasting = await fixtures.Tasting({
      bottleId: targetlessBottle.id,
      targetId: null,
      rating: 2,
      createdById: defaults.user.id,
    });
    await Promise.all([
      fixtures.Tasting({
        bottleId: exactBottle.id,
        targetId: exactTargets.exact,
        rating: 2,
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: genericBottle.id,
        targetId: genericTargets.generic,
        rating: 1,
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: nullFlavorBottle.id,
        rating: 2,
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: nullRatingBottle.id,
        rating: null,
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: exactBottle.id,
        targetId: exactTargets.exact,
        rating: 2,
      }),
    ]);

    const response = await routerClient.users.flavorList(
      { user: "me" },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({
      results: [
        { flavorProfile: "spicy_sweet", count: 1, score: 0 },
        { flavorProfile: "heavily_peated", count: 1, score: 2 },
        { flavorProfile: "peated", count: 1, score: 2 },
        { flavorProfile: "lightly_peated", count: 1, score: 1 },
        { flavorProfile: "oily_coastal", count: 1, score: 1 },
      ],
      totalScore: 10,
      totalCount: 7,
    });

    const [persistedDrift, persistedPromoted, persistedTargetless] =
      await Promise.all([
        db.query.tastings.findFirst({
          where: eq(tastings.id, driftTasting.id),
          columns: { bottleId: true, releaseId: true, targetId: true },
        }),
        db.query.tastings.findFirst({
          where: eq(tastings.id, promotedTasting.id),
          columns: { bottleId: true, releaseId: true, targetId: true },
        }),
        db.query.tastings.findFirst({
          where: eq(tastings.id, targetlessTasting.id),
          columns: { bottleId: true, releaseId: true, targetId: true },
        }),
      ]);
    expect(persistedDrift).toEqual({
      bottleId: retainedDriftBottle.id,
      releaseId: null,
      targetId: targetBottleTargets.exact,
    });
    expect(persistedPromoted).toEqual({
      bottleId: promotionParent.id,
      releaseId: release.id,
      targetId: promotedTarget.id,
    });
    expect(persistedTargetless).toEqual({
      bottleId: targetlessBottle.id,
      releaseId: null,
      targetId: null,
    });
  });

  test("scans tasting targets across the batch boundary", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const { exact } = await targetIds(bottle.id, bottle.groupId!);
    await db.insert(tastings).values(
      Array.from({ length: 201 }, (_, index) => ({
        bottleId: bottle.id,
        targetId: exact,
        rating: 1,
        createdById: defaults.user.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
      })),
    );

    const response = await routerClient.users.flavorList(
      { user: defaults.user.username },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({
      results: [{ flavorProfile: "peated", count: 201, score: 201 }],
      totalScore: 201,
      totalCount: 201,
    });
  });

  test("fails closed when an exact target is retired", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const replacement = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.users.flavorList(
        { user: "me" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("fails closed when a generic target is retired", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const replacement = await fixtures.Bottle();
    const { generic } = await targetIds(bottle.id, bottle.groupId!);
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: generic,
      createdById: defaults.user.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: bottle.groupId!,
      newGroupId: replacement.groupId!,
      createdByActorId: bottle.createdByActorId,
    });

    const error = await waitError(
      routerClient.users.flavorList(
        { user: "me" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("fails closed when a durable target cannot be validated", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const { exact } = await targetIds(bottle.id, bottle.groupId!);
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: exact,
      rating: 2,
      createdById: defaults.user.id,
    });
    const persistedBefore = await db.query.tastings.findFirst({
      where: eq(tastings.id, tasting.id),
      columns: { bottleId: true, releaseId: true, targetId: true },
    });

    await db
      .update(bottles)
      .set({ fullName: "" })
      .where(eq(bottles.id, bottle.id));

    const error = await waitError(
      routerClient.users.flavorList(
        { user: "me" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
    ).toEqual(persistedBefore);
  });

  test("cannot list private without friend", async ({ fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.users.flavorList({
        user: otherUser.id,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User's profile is not public.]`);
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const response = await routerClient.users.flavorList(
      { user: otherUser.id },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({ results: [], totalCount: 0, totalScore: 0 });
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const response = await routerClient.users.flavorList(
      { user: otherUser.id },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({ results: [], totalCount: 0, totalScore: 0 });
  });
});
