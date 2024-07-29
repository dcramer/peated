import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("valid credentials", async ({ fixtures }) => {
  const caller = createCaller();

  const data = await caller.authRegister({
    username: "foo",
    email: "foo@example.com",
    password: "example",
  });

  expect(data.user.id).toBeDefined();
  expect(data.accessToken).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, data.user.id));
  expect(user.username).toEqual("foo");
  expect(user.email).toEqual("foo@example.com");
  expect(user.passwordHash).not.toBeNull();
  expect(compareSync("example", user.passwordHash as string)).toBeTruthy();
});

test("duplicate username", async ({ fixtures }) => {
  const caller = createCaller();

  await fixtures.User({ username: "foo" });

  const err = await waitError(
    caller.authRegister({
      username: "foo",
      email: "foo@example.com",
      password: "example",
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Conflicting object already exists (ID=2).]`,
  );
});

test("duplicate email", async ({ fixtures }) => {
  const caller = createCaller();

  await fixtures.User({ email: "foo@example.com" });

  const err = await waitError(
    caller.authRegister({
      username: "foobar",
      email: "foo@example.com",
      password: "example",
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Conflicting object already exists (ID=2).]`,
  );
});
