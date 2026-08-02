import { app } from "@peated/server/app";
import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import { issueOAuthAuthorizationCode } from "@peated/server/lib/oauthAuthorization";
import type * as FixtureModule from "@peated/server/lib/test/fixtures";
import { describe, expect, test } from "vitest";

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";
type Fixtures = typeof FixtureModule;

async function issueCode(fixtures: Fixtures) {
  const user = await fixtures.User();
  const client = await fixtures.OAuthClient();
  const redirectUri = "http://127.0.0.1:45678/callback";
  const authorization = await issueOAuthAuthorizationCode({
    user,
    request: {
      responseType: "code",
      clientId: client.clientId,
      redirectUri,
      state: "opaque-state",
      codeChallenge: createS256CodeChallenge(verifier),
      codeChallengeMethod: "S256",
    },
  });
  if (!authorization)
    throw new Error("Failed to issue test authorization code");

  return { user, client, redirectUri, code: authorization.code };
}

function tokenRequest(values: Record<string, string>) {
  return app.request("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
}

describe("POST /oauth/token", () => {
  test("exchanges a PKCE code for the existing bearer token", async ({
    fixtures,
  }) => {
    const { user, client, redirectUri, code } = await issueCode(fixtures);
    const response = await tokenRequest({
      grant_type: "authorization_code",
      code,
      client_id: client.clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    const token = (await response.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };
    expect(token.token_type).toBe("Bearer");
    expect(token.expires_in).toBe(604800);

    const me = await app.request(
      "/v1/auth/me",
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
      },
      {
        incoming: {
          socket: {
            remoteAddress: "127.0.0.1",
            remotePort: 12345,
            remoteFamily: "IPv4",
          },
        },
      },
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ user: { id: user.id } });
  });

  test("returns standard errors for malformed and unsupported requests", async () => {
    const wrongContentType = await app.request("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code" }),
    });
    expect(wrongContentType.status).toBe(400);
    expect(await wrongContentType.json()).toEqual({ error: "invalid_request" });

    const unsupported = await tokenRequest({ grant_type: "refresh_token" });
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toEqual({
      error: "unsupported_grant_type",
    });

    const missingCode = await tokenRequest({
      grant_type: "authorization_code",
    });
    expect(missingCode.status).toBe(400);
    expect(await missingCode.json()).toEqual({ error: "invalid_request" });
  });

  test("rejects an invalid verifier and replay", async ({ fixtures }) => {
    const { client, redirectUri, code } = await issueCode(fixtures);
    const input = {
      grant_type: "authorization_code",
      code,
      client_id: client.clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    };

    const invalid = await tokenRequest({
      ...input,
      code_verifier: `${verifier}x`,
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "invalid_grant" });

    expect((await tokenRequest(input)).status).toBe(200);
    const replay = await tokenRequest(input);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_grant" });
  });
});
