import { createRouterClient } from "@orpc/server";
import { db } from "@peated/server/db";
import { identities, users } from "@peated/server/db/schema";
import { AppleIdentityTokenError } from "@peated/server/lib/apple";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import {
  createLoginProcedure,
  type LoginServices,
} from "@peated/server/orpc/routes/auth/login";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("POST /auth/login", () => {
  test("valid credentials", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const data = await routerClient.auth.login(
      {
        email: "foo@example.com",
        password: "example",
      },
      { context: { ip: "127.0.0.1" } },
    );

    expect(data.user.id).toEqual(user.id);
    expect(data.accessToken).toBeDefined();
  });

  test("invalid credentials", async ({ fixtures }) => {
    await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const err = await waitError(
      routerClient.auth.login(
        {
          email: "foo@example.com",
          password: "example2",
        },
        { context: { ip: "127.0.0.1" } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid credentials.]`);
  });

  describe("Sign in with Apple", () => {
    const verifyAppleIdentityToken =
      vi.fn<LoginServices["verifyAppleIdentityToken"]>();
    const client = createRouterClient(
      { login: createLoginProcedure({ verifyAppleIdentityToken }) },
      { context: { ip: "127.0.0.1", user: null } },
    );

    const APPLE_SUB = "001234.abcdef.5678";

    beforeEach(() => {
      verifyAppleIdentityToken.mockReset();
    });

    async function findIdentity(externalId: string) {
      const [identity] = await db
        .select()
        .from(identities)
        .where(
          and(
            eq(identities.provider, "apple"),
            eq(identities.externalId, externalId),
          ),
        );
      return identity;
    }

    test("creates an account with a username from the name", async () => {
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: "abc123@privaterelay.appleid.com",
        emailVerified: true,
      });

      const data = await client.login({
        appleIdentityToken: "token",
        fullName: "Jane Doe",
        tosAccepted: true,
      });

      expect(verifyAppleIdentityToken).toHaveBeenCalledWith("token");
      expect(data.user.username).toEqual("jane-doe");
      expect(data.accessToken).toBeDefined();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, data.user.id));
      expect(user.email).toEqual("abc123@privaterelay.appleid.com");
      expect(user.verified).toBe(true);
      expect(user.termsAcceptedAt).not.toBeNull();

      const identity = await findIdentity(APPLE_SUB);
      expect(identity?.userId).toEqual(user.id);
    });

    test("creates an account with a username from the email", async () => {
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: "Jane.Doe@example.com",
        emailVerified: true,
      });

      const data = await client.login({ appleIdentityToken: "token" });

      expect(data.user.username).toEqual("jane.doe");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, data.user.id));
      expect(user.termsAcceptedAt).toBeNull();
    });

    test("signs in an existing Apple identity", async ({ fixtures }) => {
      const user = await fixtures.User({ email: "jane@example.com" });
      await db.insert(identities).values({
        provider: "apple",
        externalId: APPLE_SUB,
        userId: user.id,
      });
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: "abc123@privaterelay.appleid.com",
        emailVerified: true,
      });

      const data = await client.login({
        appleIdentityToken: "token",
        fullName: "Someone Else",
      });

      expect(data.user.id).toEqual(user.id);
      expect(data.user.username).toEqual(user.username);
    });

    test("links to a verified account with the same email", async ({
      fixtures,
    }) => {
      const user = await fixtures.User({
        email: "Jane@example.com",
        verified: true,
      });
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: "jane@example.com",
        emailVerified: true,
      });

      const data = await client.login({ appleIdentityToken: "token" });

      expect(data.user.id).toEqual(user.id);
      const identity = await findIdentity(APPLE_SUB);
      expect(identity?.userId).toEqual(user.id);
    });

    test("refuses to link to an unverified account", async ({ fixtures }) => {
      await fixtures.User({ email: "jane@example.com", verified: false });
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: "jane@example.com",
        emailVerified: true,
      });

      const err = await waitError(
        client.login({ appleIdentityToken: "token" }),
      );

      expect(err).toMatchInlineSnapshot(
        `[Error: Cannot link to unverified account. Please verify your email first.]`,
      );
      expect(await findIdentity(APPLE_SUB)).toBeUndefined();
    });

    test("refuses to link an unverified Apple email", async ({ fixtures }) => {
      await fixtures.User({ email: "jane@example.com", verified: true });
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: "jane@example.com",
        emailVerified: false,
      });

      const err = await waitError(
        client.login({ appleIdentityToken: "token" }),
      );

      expect(err).toMatchInlineSnapshot(
        `[Error: Cannot link to unverified account. Please verify your email first.]`,
      );
      expect(await findIdentity(APPLE_SUB)).toBeUndefined();
    });

    test("rejects an invalid identity token", async () => {
      verifyAppleIdentityToken.mockRejectedValue(
        new AppleIdentityTokenError("Invalid Apple identity token."),
      );

      const err = await waitError(client.login({ appleIdentityToken: "bad" }));

      expect(err).toMatchInlineSnapshot(`[Error: Invalid identity token.]`);
    });

    test("rejects a token without an email", async () => {
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: null,
        emailVerified: false,
      });

      const err = await waitError(
        client.login({ appleIdentityToken: "token" }),
      );

      expect(err).toMatchInlineSnapshot(
        `[Error: Unable to validate credentials.]`,
      );
    });

    test("rejects an inactive account", async ({ fixtures }) => {
      const user = await fixtures.User({ active: false });
      await db.insert(identities).values({
        provider: "apple",
        externalId: APPLE_SUB,
        userId: user.id,
      });
      verifyAppleIdentityToken.mockResolvedValue({
        sub: APPLE_SUB,
        email: user.email,
        emailVerified: true,
      });

      const err = await waitError(
        client.login({ appleIdentityToken: "token" }),
      );

      expect(err).toMatchInlineSnapshot(`[Error: Invalid credentials.]`);
    });
  });
});
