import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("lists friends", async ({ defaults, fixtures }) => {
  const follow1 = await fixtures.Follow({
    fromUserId: defaults.user.id,
  });
  await fixtures.Follow();

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.friendList();

  expect(results.length).toBe(1);
  expect(results[0].user.id).toBe(follow1.toUserId);
});

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.friendList());
  expect(err).toMatchInlineSnapshot();
});
