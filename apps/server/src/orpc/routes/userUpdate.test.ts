import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("PATCH /users/:user", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.userUpdate({
        user: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: UNAUTHORIZED: Authentication required]
    `);
  });

  test("cannot update another user", async ({ fixtures }) => {
    const user = await fixtures.User();
    const otherUser = await fixtures.User();

    const err = await waitError(() =>
      routerClient.userUpdate(
        {
          user: otherUser.id,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: FORBIDDEN: Cannot edit another user.]
    `);
  });

  test("can change username", async ({ defaults, fixtures }) => {
    const data = await routerClient.userUpdate(
      {
        user: defaults.user.id,
        username: "JoeBlow",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(user?.username).toEqual("joeblow");
  });

  test("can change mod as admin", async ({ defaults, fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.userUpdate(
      {
        user: defaults.user.id,
        mod: true,
      },
      { context: { user: adminUser } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(user?.mod).toEqual(true);
  });

  test("can change admin as admin", async ({ defaults, fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.userUpdate(
      {
        user: defaults.user.id,
        admin: true,
      },
      { context: { user: adminUser } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(user?.admin).toEqual(true);
  });

  test("cannot change mod as user", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.userUpdate(
        {
          user: defaults.user.id,
          mod: true,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: FORBIDDEN: Admin privileges required to modify mod status.]
    `);
  });

  test("cannot change admin as user", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.userUpdate(
        {
          user: defaults.user.id,
          admin: true,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: FORBIDDEN: Admin privileges required to modify admin status.]
    `);
  });

  test("can change password", async ({ defaults, fixtures }) => {
    const data = await routerClient.userUpdate(
      {
        user: defaults.user.id,
        username: "JoeBlow",
        password: "testpassword",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(compareSync("testpassword", user.passwordHash || "")).toBe(true);
  });

  test("rejects invalid username", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.userUpdate(
        {
          user: defaults.user.id,
          username: "me",
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: BAD_REQUEST: Invalid username.]
    `);
  });
});
