import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("get user by id", async () => {
  const user = await Fixtures.User();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.userById(user.id);
  expect(data.id).toEqual(user.id);
  expect(data.friendStatus).toBe("none");
});

test("get user:me", async () => {
  const user = await DefaultFixtures.user;

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.userById("me");
  expect(data.id).toBe(DefaultFixtures.user.id);
});

test("get user by username", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.userById(DefaultFixtures.user.username);
  expect(data.id).toBe(DefaultFixtures.user.id);
});

test("get user w/ friendStatus", async () => {
  const user = await Fixtures.User();
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: user.id,
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.userById(user.id);
  expect(data.id).toBe(user.id);
  expect(data.friendStatus).toBe("friends");
});

test("errors on invalid username", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.userById("notauser")).rejects.toThrowError(/NOT_FOUND/);
});
