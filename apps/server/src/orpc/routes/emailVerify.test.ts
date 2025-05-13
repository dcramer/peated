import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { signPayload } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { describe, test } from "vitest";
import { routerClient } from "../router";

describe("POST /email/verify", () => {
  test("valid token", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });

    const token = await signPayload({
      id: user.id,
      email: user.email,
    });

    await routerClient.emailVerify({ token });

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(newUser.verified).toEqual(true);
  });

  test("invalid token", async () => {
    const err = await waitError(
      routerClient.emailVerify({ token: "invalid-token" }),
    );

    expect(err).toMatchInlineSnapshot();
  });
});
