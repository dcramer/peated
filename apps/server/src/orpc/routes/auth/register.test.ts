import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";

describe("POST /auth/register", () => {
  test("valid credentials", async ({ fixtures }) => {
    const data = await routerClient.auth.register({
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
    expect(user.verified).toBe(false);
    expect(compareSync("example", user.passwordHash as string)).toBeTruthy();
  });

  test("duplicate username", async ({ fixtures }) => {
    await fixtures.User({ username: "foo" });

    const err = await waitError(
      routerClient.auth.register({
        username: "foo",
        email: "foo@example.com",
        password: "example",
      })
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Conflicting object already exists (ID=2).]`
    );
  });

  test("duplicate email", async ({ fixtures }) => {
    await fixtures.User({ email: "foo@example.com" });

    const err = await waitError(
      routerClient.auth.register({
        username: "foobar",
        email: "foo@example.com",
        password: "example",
      })
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Conflicting object already exists (ID=2).]`
    );
  });
});
