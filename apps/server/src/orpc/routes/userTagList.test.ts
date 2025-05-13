import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /users/:user/tags", () => {
  test("lists tags", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "A",
    });
    const bottle2 = await fixtures.Bottle({
      brandId: bottle.brandId,
      name: "B",
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["solvent", "caramel"],
      rating: 5,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["caramel"],
      rating: 5,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      tags: ["cedar", "caramel"],
      rating: 5,
    });

    const { results, totalCount } = await routerClient.userTagList(
      { user: "me" },
      { context: { user: defaults.user } },
    );

    expect(totalCount).toEqual(2);
    expect(results).toEqual([
      { tag: "caramel", count: 2 },
      { tag: "solvent", count: 1 },
    ]);
  });

  test("cannot list private without friend", async ({ fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.userTagList({
        user: otherUser.id,
      }),
    );
    expect(err.message).toMatchInlineSnapshot();
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.userTagList(
      { user: otherUser.id },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.userTagList(
      { user: otherUser.id },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });
});
