import { FLAVOR_PROFILES } from "@peated/server/constants";
import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /users/:user/flavors", () => {
  test("lists flavor profiles", async ({ defaults, fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      flavorProfile: "peated",
    });
    const bottle2 = await fixtures.Bottle({
      flavorProfile: "juicy_oak_vanilla",
    });
    const bottle3 = await fixtures.Bottle({
      flavorProfile: "peated",
    });

    // Create tastings for the default user
    await fixtures.Tasting({
      bottleId: bottle1.id,
      rating: 5,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      rating: 4,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle3.id,
      rating: 3,
      createdById: defaults.user.id,
    });

    // Create a tasting by another user (should not be counted)
    await fixtures.Tasting({
      bottleId: bottle1.id,
      rating: 5,
    });

    const { results, totalCount, totalScore } =
      await routerClient.userFlavorList(
        {
          user: "me",
        },
        { context: { user: defaults.user } },
      );

    expect(totalCount).toEqual(3);
    expect(totalScore).toEqual(12);
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "count": 2,
          "flavorProfile": "peated",
          "score": 8,
        },
        {
          "count": 1,
          "flavorProfile": "juicy_oak_vanilla",
          "score": 4,
        },
      ]
    `);
  });

  test("cannot list private without friend", async ({ fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.userFlavorList({
        user: otherUser.id,
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.userFlavorList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.userFlavorList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("handles null flavor profiles", async ({ defaults, fixtures }) => {
    const bottle1 = await fixtures.Bottle({
      flavorProfile: "lightly_peated",
    });
    const bottle2 = await fixtures.Bottle({
      flavorProfile: null,
    });

    // Create tastings for the default user
    await fixtures.Tasting({
      bottleId: bottle1.id,
      rating: 5,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      rating: 4,
      createdById: defaults.user.id,
    });

    const { results, totalCount, totalScore } =
      await routerClient.userFlavorList(
        {
          user: "me",
        },
        { context: { user: defaults.user } },
      );

    expect(totalCount).toEqual(2);
    expect(totalScore).toEqual(9);
    // Only the non-null flavor profile should be counted
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "count": 1,
          "flavorProfile": "lightly_peated",
          "score": 5,
        },
      ]
    `);
  });
});
