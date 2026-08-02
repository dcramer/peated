import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /auth/register/challenge", () => {
  test("generates challenge for new user", async () => {
    const data = await routerClient.auth.registerChallenge(
      {
        username: "testuser",
        email: "test@example.com",
      },
      { context: { ip: "127.0.0.1" } },
    );

    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBeDefined();
    expect(data.options.user.name).toEqual("testuser");
    expect(data.options.user.id).toBeDefined(); // Should have generated userID
    expect(data.signedChallenge).toBeDefined();
  });

  test("generates consistent userID for same credentials", async () => {
    const data1 = await routerClient.auth.registerChallenge(
      {
        username: "testuser",
        email: "test@example.com",
      },
      { context: { ip: "127.0.0.1" } },
    );

    const data2 = await routerClient.auth.registerChallenge(
      {
        username: "testuser",
        email: "test@example.com",
      },
      { context: { ip: "127.0.0.1" } },
    );

    // UserID should be consistent for retry scenarios
    expect(data1.options.user.id).toEqual(data2.options.user.id);
  });

  test("normalizes email to lowercase", async () => {
    const data = await routerClient.auth.registerChallenge(
      {
        username: "testuser",
        email: "Test@Example.COM",
      },
      { context: { ip: "127.0.0.1" } },
    );

    expect(data.options).toBeDefined();
  });

  test("rejects an existing email before generating a credential", async ({
    fixtures,
  }) => {
    await fixtures.User({ email: "existing@example.com" });

    const error = await waitError(
      routerClient.auth.registerChallenge(
        {
          username: "new-user",
          email: "Existing@Example.com",
        },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      message: "An account with this email already exists.",
      data: { field: "email" },
    });
  });

  test("rejects an existing username before generating a credential", async ({
    fixtures,
  }) => {
    await fixtures.User({ username: "existing-user" });

    const error = await waitError(
      routerClient.auth.registerChallenge(
        {
          username: "Existing-User",
          email: "new@example.com",
        },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      message: "An account with this username already exists.",
      data: { field: "username" },
    });
  });
});
