import { db } from "@peated/server/db";
import { oauthAuthorizationCodes } from "@peated/server/db/schema";
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

describe("POST /oauth/authorization-code", () => {
  test("requires authentication", async ({ fixtures }) => {
    const client = await fixtures.OAuthClient();
    const error = await waitError(
      routerClient.oauth.authorize(request(client.clientId)),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("issues and persists an authorization code", async ({ fixtures }) => {
    const client = await fixtures.OAuthClient();
    const user = await fixtures.User();
    const input = request(client.clientId);

    const result = await routerClient.oauth.authorize(input, {
      context: { user },
    });

    expect(result).toMatchObject({
      redirectUri: input.redirectUri,
      state: input.state,
    });
    expect(result.code).toBeTruthy();
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(1);
  });
});
