import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

function request(clientId: string) {
  return {
    responseType: "code" as const,
    clientId,
    redirectUri: "http://127.0.0.1:45678/callback",
    state: "opaque-state",
    codeChallenge: createS256CodeChallenge(verifier),
    codeChallengeMethod: "S256" as const,
  };
}

describe("GET /oauth/authorization-details", () => {
  test("returns public client details for a valid request", async ({
    fixtures,
  }) => {
    const client = await fixtures.OAuthClient();

    const result = await routerClient.oauth.authorizationDetails(
      request(client.clientId),
    );

    expect(result).toEqual({ clientId: client.clientId, name: client.name });
  });

  test("rejects an invalid redirect URI", async ({ fixtures }) => {
    const client = await fixtures.OAuthClient();
    const error = await waitError(
      routerClient.oauth.authorizationDetails({
        ...request(client.clientId),
        redirectUri: "https://evil.example/callback",
      }),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Invalid authorization request.]`,
    );
  });
});
