import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /tastings", () => {
  test("lists tastings", async ({ fixtures }) => {
    await fixtures.Tasting();
    await fixtures.Tasting();

    const { results } = await routerClient.tastingList();

    expect(results.length).toBe(2);
  });

  test("lists tastings with bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    await fixtures.Tasting();

    const { results } = await routerClient.tastingList({
      bottle: bottle.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });

  test("lists tastings with user", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });
    await fixtures.Tasting();

    const { results } = await routerClient.tastingList({
      user: defaults.user.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });

  test("lists tastings filter friends unauthenticated", async ({
    fixtures,
  }) => {
    await fixtures.Tasting();
    await fixtures.Tasting();

    const err = await waitError(() =>
      routerClient.tastingList({
        filter: "friends",
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("lists tastings filter friends", async ({ defaults, fixtures }) => {
    await fixtures.Tasting();
    await fixtures.Tasting();

    const otherUser = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });
    const lastTasting = await fixtures.Tasting({ createdById: otherUser.id });

    const { results } = await routerClient.tastingList(
      {
        filter: "friends",
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(lastTasting.id);
  });

  test("lists tastings hides private while authenticated", async ({
    defaults,
    fixtures,
  }) => {
    const friend = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
      status: "following",
    });

    // should hide tasting from non-friend
    await fixtures.Tasting({
      createdById: (await fixtures.User({ private: true })).id,
    });
    // should show tasting from friend
    const tasting = await fixtures.Tasting({ createdById: friend.id });

    const { results } = await routerClient.tastingList(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });

  test("lists tastings hides private while anonymous", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();
    await fixtures.Tasting({
      createdById: (await fixtures.User({ private: true })).id,
    });

    const { results } = await routerClient.tastingList();

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(tasting.id);
  });
});
