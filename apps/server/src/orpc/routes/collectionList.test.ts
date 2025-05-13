import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /users/:user/collections", () => {
  test("cannot list private without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.collectionList(
        {
          user: otherUser.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err.message).toBe("User's profile is private.");
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.collectionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.collectionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("only returns collections for requested user", async ({
    defaults,
    fixtures,
  }) => {
    const otherUser = await fixtures.User({ private: false });

    // Create a collection for the requested user
    const userCollection = await fixtures.Collection({
      name: "User Collection",
      createdById: otherUser.id,
    });

    // Create a collection for a different user
    const otherUserCollection = await fixtures.Collection({
      name: "Other User Collection",
      createdById: defaults.user.id,
    });

    const { results } = await routerClient.collectionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(1);
    expect(results[0].id).toEqual(userCollection.id);
    expect(results[0].name).toEqual("User Collection");
    expect(results.some((c) => c.id === otherUserCollection.id)).toBe(false);
  });
});
