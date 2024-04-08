import { createCaller } from "../router";

test("get user by id", async ({ defaults, fixtures }) => {
  const user = await fixtures.User();

  const caller = createCaller({ user: defaults.user });
  const data = await caller.userById(user.id);
  expect(data.id).toEqual(user.id);
  expect(data.friendStatus).toBe("none");
});

test("get user:me", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.userById("me");
  expect(data.id).toBe(defaults.user.id);
});

test("get user by username", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.userById(defaults.user.username);
  expect(data.id).toBe(defaults.user.id);
});

test("get user w/ friendStatus", async ({ defaults, fixtures }) => {
  const user = await fixtures.User();
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: user.id,
  });

  const caller = createCaller({ user: defaults.user });
  const data = await caller.userById(user.id);
  expect(data.id).toBe(user.id);
  expect(data.friendStatus).toBe("friends");
});

test("errors on invalid username", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.userById("notauser")).rejects.toThrowError(/NOT_FOUND/);
});
