import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists tastings", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.tastingList();

  expect(results.length).toBe(2);
});

test("lists tastings with bottle", async () => {
  const bottle = await Fixtures.Bottle();
  const tasting = await Fixtures.Tasting({ bottleId: bottle.id });
  await Fixtures.Tasting();

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.tastingList({
    bottle: bottle.id,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings with user", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting();

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.tastingList({
    user: DefaultFixtures.user.id,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings filter friends unauthenticated", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.tastingList({
      filter: "friends",
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("lists tastings filter friends", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const otherUser = await Fixtures.User();
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });
  const lastTasting = await Fixtures.Tasting({ createdById: otherUser.id });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.tastingList({
    filter: "friends",
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(lastTasting.id);
});

test("lists tastings hides private while authenticated", async () => {
  const friend = await Fixtures.User({ private: true });
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: friend.id,
    status: "following",
  });

  // should hide tasting from non-friend
  await Fixtures.Tasting({
    createdById: (await Fixtures.User({ private: true })).id,
  });
  // should show tasting from friend
  const tasting = await Fixtures.Tasting({ createdById: friend.id });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.tastingList();

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings hides private while anonymous", async () => {
  const tasting = await Fixtures.Tasting();
  await Fixtures.Tasting({
    createdById: (await Fixtures.User({ private: true })).id,
  });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.tastingList();

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});
