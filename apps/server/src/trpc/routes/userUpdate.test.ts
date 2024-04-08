import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() =>
    caller.userUpdate({
      user: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot update another user", async ({ fixtures }) => {
  const user = await fixtures.User();
  const otherUser = await fixtures.User();

  const caller = createCaller({ user });
  expect(() =>
    caller.userUpdate({
      user: otherUser.id,
    }),
  ).rejects.toThrowError(/Cannot edit another user/);
});

test("can change displayName", async ({ defaults, fixtures }) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.userUpdate({
    user: defaults.user.id,
    displayName: "Joe",
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, defaults.user.id));
  expect(user?.displayName).toEqual("Joe");
});

test("can change username", async ({ defaults, fixtures }) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.userUpdate({
    user: defaults.user.id,
    username: "JoeBlow",
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, defaults.user.id));
  expect(user?.username).toEqual("joeblow");
});

test("can change mod as admin", async ({ defaults, fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const data = await caller.userUpdate({
    user: defaults.user.id,
    mod: true,
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, defaults.user.id));
  expect(user?.mod).toEqual(true);
});

test("can change admin as admin", async ({ defaults, fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const data = await caller.userUpdate({
    user: defaults.user.id,
    admin: true,
  });

  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, defaults.user.id));
  expect(user?.admin).toEqual(true);
});

test("cannot change mod as user", async ({ defaults }) => {
  const caller = createCaller({
    user: defaults.user,
  });
  expect(() =>
    caller.userUpdate({
      user: defaults.user.id,
      mod: true,
    }),
  ).rejects.toThrowError(/FORBIDDEN/);
});

test("cannot change admin as user", async ({ defaults }) => {
  const caller = createCaller({
    user: defaults.user,
  });
  expect(() =>
    caller.userUpdate({
      user: defaults.user.id,
      admin: true,
    }),
  ).rejects.toThrowError(/FORBIDDEN/);
});
