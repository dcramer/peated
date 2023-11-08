import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.userUpdate({
      user: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot update another person", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const caller = appRouter.createCaller({ user });
  expect(() =>
    caller.userUpdate({
      user: otherUser.id,
    }),
  ).rejects.toThrowError(/FORBIDDEN/);
});

test("can change displayName", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.userUpdate({
    user: DefaultFixtures.user.id,
    displayName: "Joe",
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, DefaultFixtures.user.id));
  expect(user.displayName).toEqual("Joe");
});

test("can change username", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.userUpdate({
    user: DefaultFixtures.user.id,
    username: "JoeBlow",
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, DefaultFixtures.user.id));
  expect(user.username).toEqual("joeblow");
});
