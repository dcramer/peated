import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("lists tags", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const bottle2 = await fixtures.Bottle({
    brandId: bottle.brandId,
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

  const caller = createCaller({ user: defaults.user });
  const { results, totalCount } = await caller.userTagList({
    user: "me",
  });

  expect(totalCount).toEqual(2);
  expect(results).toEqual([
    { tag: "caramel", count: 2 },
    { tag: "solvent", count: 1 },
  ]);
});

test("cannot list private without friend", async ({ fixtures }) => {
  const otherUser = await fixtures.User({ private: true });

  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.userTagList({
      user: otherUser.id,
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: User's profile is not public.]`,
  );
});

test("can list private with friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: true });
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.userTagList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});

test("can list public without friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: false });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.userTagList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});
