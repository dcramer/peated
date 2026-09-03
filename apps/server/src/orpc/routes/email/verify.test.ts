import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken, signToken } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, test } from "vitest";

describe("POST /email/verify", () => {
  test("valid token", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });

    const token = await signToken(
      {
        id: user.id,
        email: user.email,
      },
      "email-verification",
    );

    await routerClient.email.verify({ token });

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(newUser.verified).toEqual(true);
  });

  test("invalid token", async () => {
    const err = await waitError(
      routerClient.email.verify({ token: "invalid-token" }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid verification token.]`);
  });

  test("cannot verify email with an API access token", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });
    const token = await createAccessToken(user);

    await expect(routerClient.email.verify({ token })).rejects.toThrow(
      "Invalid verification token.",
    );

    const [storedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(storedUser.verified).toBe(false);
  });
});
