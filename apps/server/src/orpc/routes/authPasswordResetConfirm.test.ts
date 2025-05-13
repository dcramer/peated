import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { signPayload } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { compareSync } from "bcrypt";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { routerClient } from "../router";

describe("POST /auth/password-reset/confirm", () => {
  test("valid token", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signPayload({
      id: user.id,
      email: user.email,
      createdAt: new Date(),
      digest: createHash("md5")
        .update(user.passwordHash || "")
        .digest("hex"),
    });

    await routerClient.authPasswordResetConfirm({
      token,
      password: "testpassword",
    });

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(compareSync("testpassword", newUser.passwordHash || "")).toBe(true);
  });

  test("invalid digest", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signPayload({
      id: user.id,
      email: user.email,
      createdAt: new Date(),
      digest: "abc",
    });

    const err = await waitError(
      routerClient.authPasswordResetConfirm({
        token,
        password: "testpassword",
      }),
    );

    expect(err).toMatchInlineSnapshot();

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(compareSync("testpassword", newUser.passwordHash || "")).toBe(false);
  });

  test("expired token", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signPayload({
      id: user.id,
      email: user.email,
      createdAt: new Date("2023-12-01T12:56:36Z"),
      digest: createHash("md5")
        .update(user.passwordHash || "")
        .digest("hex"),
    });

    const err = await waitError(
      routerClient.authPasswordResetConfirm({
        token,
        password: "testpassword",
      }),
    );

    expect(err).toMatchInlineSnapshot();

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(compareSync("testpassword", newUser.passwordHash || "")).toBe(false);
  });
});
