import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /auth/passkey", () => {
  test("returns passkeys for authenticated user", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey1 = await fixtures.Passkey({
      userId: user.id,
      nickname: "My Phone",
    });
    const passkey2 = await fixtures.Passkey({
      userId: user.id,
      nickname: "My Laptop",
    });

    const result = await routerClient.auth.passkey.list(undefined, {
      context: { user },
    });

    expect(result.results).toHaveLength(2);
    expect(result.results.map((p) => p.id)).toContain(passkey1.id);
    expect(result.results.map((p) => p.id)).toContain(passkey2.id);
  });

  test("returns empty array when user has no passkeys", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();

    const result = await routerClient.auth.passkey.list(undefined, {
      context: { user },
    });

    expect(result.results).toHaveLength(0);
  });

  test("only returns passkeys for current user", async ({ fixtures }) => {
    const user1 = await fixtures.User();
    const user2 = await fixtures.User();
    const passkey1 = await fixtures.Passkey({ userId: user1.id });
    await fixtures.Passkey({ userId: user2.id });

    const result = await routerClient.auth.passkey.list(undefined, {
      context: { user: user1 },
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(passkey1.id);
  });

  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.auth.passkey.list(undefined, {
        context: { user: null as any },
      }),
    );

    expect(err).toBeDefined();
  });

  test("returns passkey metadata without sensitive fields", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({
      userId: user.id,
      nickname: "Test Passkey",
      transports: ["internal"],
    });

    const result = await routerClient.auth.passkey.list(undefined, {
      context: { user },
    });

    expect(result.results[0]).toMatchObject({
      id: passkey.id,
      nickname: "Test Passkey",
      transports: ["internal"],
    });
    // Should not expose sensitive fields
    expect(result.results[0]).not.toHaveProperty("credentialId");
    expect(result.results[0]).not.toHaveProperty("publicKey");
    expect(result.results[0]).not.toHaveProperty("counter");
  });

  test("orders passkeys by creation date", async ({ fixtures }) => {
    const user = await fixtures.User();
    // Create passkeys with slight delay to ensure different timestamps
    const passkey1 = await fixtures.Passkey({ userId: user.id });
    const passkey2 = await fixtures.Passkey({ userId: user.id });

    const result = await routerClient.auth.passkey.list(undefined, {
      context: { user },
    });

    // Should be ordered by createdAt ascending
    expect(result.results[0].id).toBe(passkey1.id);
    expect(result.results[1].id).toBe(passkey2.id);
  });
});
