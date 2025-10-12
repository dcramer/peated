import { routerClient } from "@peated/server/orpc/router";

describe("POST /auth/passkey/authenticate/challenge", () => {
  test("generates challenge and signed token", async () => {
    const data = await routerClient.auth.passkey.authenticateChallenge({});

    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBeDefined();
    expect(data.signedChallenge).toBeDefined();
  });

  test("challenge is unique per request", async () => {
    const data1 = await routerClient.auth.passkey.authenticateChallenge({});
    const data2 = await routerClient.auth.passkey.authenticateChallenge({});

    expect(data1.options.challenge).not.toEqual(data2.options.challenge);
    expect(data1.signedChallenge).not.toEqual(data2.signedChallenge);
  });
});
