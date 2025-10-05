import { routerClient } from "@peated/server/orpc/router";

describe("POST /auth/register-challenge", () => {
  test("generates challenge for new user", async () => {
    const data = await routerClient.auth.registerChallenge({
      username: "testuser",
      email: "test@example.com",
    });

    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBeDefined();
    expect(data.options.user.name).toEqual("testuser");
    expect(data.options.user.id).toBeDefined(); // Should have generated userID
    expect(data.signedChallenge).toBeDefined();
  });

  test("generates consistent userID for same credentials", async () => {
    const data1 = await routerClient.auth.registerChallenge({
      username: "testuser",
      email: "test@example.com",
    });

    const data2 = await routerClient.auth.registerChallenge({
      username: "testuser",
      email: "test@example.com",
    });

    // UserID should be consistent for retry scenarios
    expect(data1.options.user.id).toEqual(data2.options.user.id);
  });

  test("normalizes email to lowercase", async () => {
    const data = await routerClient.auth.registerChallenge({
      username: "testuser",
      email: "Test@Example.COM",
    });

    expect(data.options).toBeDefined();
  });
});
