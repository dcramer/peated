import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "@peated/server/trpc/router";

test("cannot list private without friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: true });

  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.collectionBottleList({
      user: otherUser.id,
      collection: "default",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: User's profile is private.]`);
});

test("can list private with friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: true });
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.collectionBottleList({
    user: otherUser.id,
    collection: "default",
  });

  expect(results.length).toEqual(0);
});

test("can list public without friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: false });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.collectionBottleList({
    user: otherUser.id,
    collection: "default",
  });

  expect(results.length).toEqual(0);
});
