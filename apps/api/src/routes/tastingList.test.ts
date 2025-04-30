import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("lists tastings", async ({ fixtures }) => {
  await fixtures.Tasting();
  await fixtures.Tasting();

  const caller = createCaller({ user: null });
  const { results } = await caller.tastingList();

  expect(results.length).toBe(2);
});

test("lists tastings with bottle", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const tasting = await fixtures.Tasting({ bottleId: bottle.id });
  await fixtures.Tasting();

  const caller = createCaller({ user: null });
  const { results } = await caller.tastingList({
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

  const caller = createCaller({ user: null });
  const { results } = await caller.tastingList({
    user: defaults.user.id,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings filter friends unauthenticated", async ({ fixtures }) => {
  await fixtures.Tasting();
  await fixtures.Tasting();

  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.tastingList({
      filter: "friends",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
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

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.tastingList({
    filter: "friends",
  });

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

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.tastingList();

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings hides private while anonymous", async ({ fixtures }) => {
  const tasting = await fixtures.Tasting();
  await fixtures.Tasting({
    createdById: (await fixtures.User({ private: true })).id,
  });

  const caller = createCaller({ user: null });
  const { results } = await caller.tastingList();

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});
