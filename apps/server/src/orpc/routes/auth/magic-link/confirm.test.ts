import {
  generateMagicLink,
  getUserFromHeader,
  signToken,
} from "@peated/server/lib/auth";
import { routerClient } from "@peated/server/orpc/router";

const context = { ip: "127.0.0.1", user: null };

describe("POST /auth/magic-link/confirm", () => {
  test("confirms magic link and issues a usable access token", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ active: true, verified: false });
    const { token } = await generateMagicLink(user);

    const result = await routerClient.auth.magicLink.confirm(
      { token },
      { context },
    );

    expect(result.user.id).toBe(user.id);
    expect(result.user.verified).toBe(true);
    await expect(
      getUserFromHeader(`Bearer ${result.accessToken}`),
    ).resolves.toMatchObject({ id: user.id });
  });

  test("rejects invalid token", async () => {
    await expect(
      routerClient.auth.magicLink.confirm(
        { token: "invalid-token" },
        { context },
      ),
    ).rejects.toThrow("Invalid magic link token.");
  });

  test("rejects expired token", async ({ fixtures }) => {
    const user = await fixtures.User();
    const token = await signToken(
      {
        id: user.id,
        email: user.email,
        createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      },
      "magic-link",
    );

    await expect(
      routerClient.auth.magicLink.confirm({ token }, { context }),
    ).rejects.toThrow("Invalid magic link token.");
  });

  test("rejects inactive user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });
    const { token } = await generateMagicLink(user);

    await expect(
      routerClient.auth.magicLink.confirm({ token }, { context }),
    ).rejects.toThrow("Invalid magic link token.");
  });

  test("rejects non-existent user", async () => {
    const token = await signToken(
      {
        id: 999999,
        email: "nonexistent@example.com",
        createdAt: new Date().toISOString(),
      },
      "magic-link",
    );

    await expect(
      routerClient.auth.magicLink.confirm({ token }, { context }),
    ).rejects.toThrow("Invalid magic link token.");
  });

  for (const purpose of ["access", "recovery", "email-verification"] as const) {
    test(`rejects a ${purpose} token even when its payload matches a magic link`, async ({
      fixtures,
    }) => {
      const user = await fixtures.User({ verified: false });
      const token = await signToken(
        {
          id: user.id,
          email: user.email,
          createdAt: new Date().toISOString(),
        },
        purpose,
      );

      await expect(
        routerClient.auth.magicLink.confirm({ token }, { context }),
      ).rejects.toThrow("Invalid magic link token.");
    });
  }
});
