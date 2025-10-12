import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /auth/passkey/register/challenge", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.auth.passkey.registerChallenge({}),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("generates challenge with user context", async ({ fixtures }) => {
    const user = await fixtures.User();

    const data = await routerClient.auth.passkey.registerChallenge(
      {},
      { context: { user } },
    );

    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBeDefined();
    expect(data.options.user.id).toBeDefined();
    expect(data.options.user.name).toEqual(user.username);
    expect(data.signedChallenge).toBeDefined();
  });
});
