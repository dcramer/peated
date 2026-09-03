import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { signToken } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { compareSync } from "bcrypt";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";

describe("POST /auth/password-reset/confirm", () => {
  test("rejects magic-link tokens across recovery flows", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ verified: false });
    const token = await signToken(
      {
        id: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        digest: createHash("sha256")
          .update(user.passwordHash || "")
          .digest("hex"),
      },
      "magic-link",
    );
    const options = { context: { ip: "127.0.0.1" } };

    await expect(
      routerClient.auth.recovery.confirm(
        { token, password: "newpassword" },
        options,
      ),
    ).rejects.toThrow("Invalid verification token.");
    await expect(
      routerClient.auth.recovery.challenge({ token }, options),
    ).rejects.toThrow("Invalid verification token.");
    await expect(
      routerClient.auth.recovery.confirmPasskey(
        {
          token,
          signedChallenge: "unused-challenge",
          passkeyResponse: {
            id: "unused-credential",
            rawId: "unused-credential",
            type: "public-key",
            clientExtensionResults: {},
            response: {
              clientDataJSON: "unused-client-data",
              attestationObject: "unused-attestation",
            },
          },
        },
        options,
      ),
    ).rejects.toThrow("Invalid verification token.");

    const [storedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(storedUser.passwordHash).toBe(user.passwordHash);
    expect(storedUser.verified).toBe(false);
  });

  test("valid token", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signToken(
      {
        id: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        digest: createHash("sha256")
          .update(user.passwordHash || "")
          .digest("hex"),
      },
      "recovery",
    );

    await routerClient.auth.recovery.confirm(
      {
        token,
        password: "testpassword",
      },
      { context: { ip: "127.0.0.1" } },
    );

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(compareSync("testpassword", newUser.passwordHash || "")).toBe(true);
  });

  test("invalid digest", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signToken(
      {
        id: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        digest: "abc",
      },
      "recovery",
    );

    const err = await waitError(
      routerClient.auth.recovery.confirm(
        {
          token,
          password: "testpassword",
        },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid verification token.]`);

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(compareSync("testpassword", newUser.passwordHash || "")).toBe(false);
  });

  test("expired token", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signToken(
      {
        id: user.id,
        email: user.email,
        createdAt: "2023-12-01T12:56:36Z",
        digest: createHash("sha256")
          .update(user.passwordHash || "")
          .digest("hex"),
      },
      "recovery",
    );

    const err = await waitError(
      routerClient.auth.recovery.confirm(
        {
          token,
          password: "testpassword",
        },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Token has expired.]`);

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(compareSync("testpassword", newUser.passwordHash || "")).toBe(false);
  });
});
