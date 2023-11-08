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
    caller.collectionList({
      user: otherUser.id,
    }),
  ).rejects.toThrowError(/BAD_REQUEST/);
});

test("can list private with friend", async () => {
  const otherUser = await Fixtures.User({ private: true });
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.collectionList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(1);
});

test("can list public without friend", async () => {
  const otherUser = await Fixtures.User({ private: false });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.collectionList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(1);
});
