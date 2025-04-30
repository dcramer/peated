import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("lists entities", async ({ fixtures }) => {
  await fixtures.Entity({ name: "A" });
  await fixtures.Entity({ name: "B" });

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});

test("cannot list private without friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: true });

  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.collectionList({
      user: otherUser.id,
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
  const { results } = await caller.collectionList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});

test("can list public without friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: false });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.collectionList({
    user: otherUser.id,
  });

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

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.collectionList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(1);
  expect(results[0].id).toEqual(userCollection.id);
  expect(results[0].name).toEqual("User Collection");
  expect(results.some((c) => c.id === otherUserCollection.id)).toBe(false);
});
