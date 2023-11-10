import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists tags", async () => {
  const bottle = await Fixtures.Bottle();
  const bottle2 = await Fixtures.Bottle({
    brandId: bottle.brandId,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["solvent", "caramel"],
    rating: 5,
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["caramel"],
    rating: 5,
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting({
    bottleId: bottle2.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results, totalCount } = await caller.userTagList({
    user: "me",
  });

  expect(totalCount).toEqual(2);
  expect(results).toEqual([
    { tag: "caramel", count: 2 },
    { tag: "solvent", count: 1 },
  ]);
});

test("cannot list private without friend", async () => {
  const otherUser = await Fixtures.User({ private: true });

  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.userTagList({
      user: otherUser.id,
    }),
  ).rejects.toThrowError(/User's profile is not public/);
});

test("can list private with friend", async () => {
  const otherUser = await Fixtures.User({ private: true });
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.userTagList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});

test("can list public without friend", async () => {
  const otherUser = await Fixtures.User({ private: false });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.userTagList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});
