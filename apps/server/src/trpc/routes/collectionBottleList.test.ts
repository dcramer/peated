import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists entities", async () => {
  await Fixtures.Entity();
  await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});

test("cannot list private without friend", async () => {
  const otherUser = await Fixtures.User({ private: true });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.collectionBottleList({
      user: otherUser.id,
      collection: "default",
    }),
  ).rejects.toThrowError(/User's profile is private/);
});

test("can list private with friend", async () => {
  const otherUser = await Fixtures.User({ private: true });
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.collectionBottleList({
    user: otherUser.id,
    collection: "default",
  });

  expect(results.length).toEqual(0);
});

test("can list public without friend", async () => {
  const otherUser = await Fixtures.User({ private: false });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.collectionBottleList({
    user: otherUser.id,
    collection: "default",
  });

  expect(results.length).toEqual(0);
});
