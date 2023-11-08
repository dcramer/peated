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

test("cannot update another user", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const caller = appRouter.createCaller({ user });
  expect(() =>
    caller.userUpdate({
      user: otherUser.id,
    }),
  ).rejects.toThrowError(/Cannot edit another user/);
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

test("can change mod as admin", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const data = await caller.userUpdate({
    user: DefaultFixtures.user.id,
    mod: true,
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, DefaultFixtures.user.id));
  expect(user.mod).toEqual(true);
});

test("can change admin as admin", async () => {
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const data = await caller.userUpdate({
    user: DefaultFixtures.user.id,
    admin: true,
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, DefaultFixtures.user.id));
  expect(user.admin).toEqual(true);
});

test("cannot change mod as user", async () => {
  const caller = appRouter.createCaller({
    user: DefaultFixtures.user,
  });
  expect(() =>
    caller.userUpdate({
      user: DefaultFixtures.user.id,
      mod: true,
    }),
  ).rejects.toThrowError(/FORBIDDEN/);
});

test("cannot change admin as user", async () => {
  const caller = appRouter.createCaller({
    user: DefaultFixtures.user,
  });
  expect(() =>
    caller.userUpdate({
      user: DefaultFixtures.user.id,
      admin: true,
    }),
  ).rejects.toThrowError(/FORBIDDEN/);
});
