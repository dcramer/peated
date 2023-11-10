import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists friends", async () => {
  const follow1 = await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
  });
  await Fixtures.Follow();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.friendList();

  expect(results.length).toBe(1);
  expect(results[0].user.id).toBe(follow1.toUserId);
});

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.friendList()).rejects.toThrowError(/UNAUTHORIZED/);
});
