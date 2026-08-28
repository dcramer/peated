import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/flavors", () => {
  test("uses Bottle-owned flavors and top tasting bands", async ({
    defaults,
    fixtures,
  }) => {
    const peatedBottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const spicyBottle = await fixtures.Bottle({
      flavorProfile: "spicy_dry",
    });
    const youngBottle = await fixtures.Bottle({
      flavorProfile: "young_spritely",
    });
    const sweetBottle = await fixtures.Bottle({
      flavorProfile: "sweet_fruit_mellow",
    });
    const oldBottle = await fixtures.Bottle({
      flavorProfile: "old_dignified",
    });
    const nullFlavorBottle = await fixtures.Bottle({ flavorProfile: null });
    const nullRatingBottle = await fixtures.Bottle({
      flavorProfile: "spicy_sweet",
    });

    await db
      .update(bottleGroups)
      .set({ flavorProfile: "juicy_oak_vanilla" })
      .where(eq(bottleGroups.id, peatedBottle.groupId!));
    await db
      .update(bottleGroups)
      .set({ flavorProfile: "lightly_peated" })
      .where(eq(bottleGroups.id, spicyBottle.groupId!));

    await Promise.all([
      fixtures.Tasting({
        bottleId: peatedBottle.id,
        ratingBand: "outstanding",
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: spicyBottle.id,
        ratingBand: "good",
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: youngBottle.id,
        ratingBand: "unicorn",
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: sweetBottle.id,
        ratingBand: "good",
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: oldBottle.id,
        ratingBand: "outstanding",
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: nullFlavorBottle.id,
        ratingBand: "unicorn",
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: nullRatingBottle.id,
        ratingBand: null,
        createdById: defaults.user.id,
      }),
      fixtures.Tasting({
        bottleId: peatedBottle.id,
        ratingBand: "outstanding",
      }),
    ]);

    const response = await routerClient.users.flavorList(
      { user: "me" },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({
      results: [
        { flavorProfile: "old_dignified", count: 1, topBandCount: 1 },
        { flavorProfile: "peated", count: 1, topBandCount: 1 },
        { flavorProfile: "young_spritely", count: 1, topBandCount: 1 },
        { flavorProfile: "spicy_dry", count: 1, topBandCount: 0 },
        { flavorProfile: "spicy_sweet", count: 1, topBandCount: 0 },
        { flavorProfile: "sweet_fruit_mellow", count: 1, topBandCount: 0 },
      ],
      totalTopBandCount: 4,
      totalCount: 7,
    });
  });

  test("scans tasting Bottles across the batch boundary", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ flavorProfile: "peated" });
    await db.insert(tastings).values(
      Array.from({ length: 201 }, (_, index) => ({
        bottleId: bottle.id,
        ratingBand: "good" as const,
        createdById: defaults.user.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
      })),
    );

    const response = await routerClient.users.flavorList(
      { user: defaults.user.username },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({
      results: [{ flavorProfile: "peated", count: 201, topBandCount: 0 }],
      totalTopBandCount: 0,
      totalCount: 201,
    });
  });

  test("fails closed when a Bottle is retired", async ({
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

    expect(response).toEqual({
      results: [],
      totalCount: 0,
      totalTopBandCount: 0,
    });
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const response = await routerClient.users.flavorList(
      { user: otherUser.id },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({
      results: [],
      totalCount: 0,
      totalTopBandCount: 0,
    });
  });
});
