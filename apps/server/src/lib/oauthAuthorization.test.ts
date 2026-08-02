import { db } from "@peated/server/db";
import {
  oauthAuthorizationCodes,
  oauthClients,
} from "@peated/server/db/schema";
import {
  createS256CodeChallenge,
  digestAuthorizationCode,
} from "@peated/server/lib/oauth";
import {
  exchangeOAuthAuthorizationCode,
  findOAuthClientForAuthorization,
  issueOAuthAuthorizationCode,
} from "@peated/server/lib/oauthAuthorization";
import type { OAuthAuthorizationRequest } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

function request(
  clientId: string,
  overrides: Partial<OAuthAuthorizationRequest> = {},
): OAuthAuthorizationRequest {
  return {
    responseType: "code",
    clientId,
    redirectUri: "http://127.0.0.1:45678/callback",
    state: "opaque-state",
    codeChallenge: createS256CodeChallenge(verifier),
    codeChallengeMethod: "S256",
    ...overrides,
  };
}

describe("OAuth authorization codes", () => {
  test("validates active clients, registered redirects, and opaque state", async ({
    fixtures,
  }) => {
    const client = await fixtures.OAuthClient({
      redirectUris: ["http://127.0.0.1/callback"],
    });

    expect(
      await findOAuthClientForAuthorization(request(client.clientId)),
    ).toEqual(client);
    expect(
      await findOAuthClientForAuthorization(
        request(client.clientId, { state: "state-kept-opaque" }),
      ),
    ).toEqual(client);
    expect(
      await findOAuthClientForAuthorization(
        request(client.clientId, {
          redirectUri: "http://127.0.0.1:45678/other",
        }),
      ),
    ).toBeNull();

    await db
      .update(oauthClients)
      .set({ active: false })
      .where(eq(oauthClients.id, client.id));
    expect(
      await findOAuthClientForAuthorization(request(client.clientId)),
    ).toBeNull();
  });

  test("stores only a digest and exchanges a code once", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const client = await fixtures.OAuthClient();
    const authorization = await issueOAuthAuthorizationCode({
      request: request(client.clientId),
      user,
    });

    expect(authorization).not.toBeNull();
    expect(authorization?.state).toBe("opaque-state");
    const [stored] = await db.select().from(oauthAuthorizationCodes);
    expect(stored.codeDigest).toBe(
      digestAuthorizationCode(authorization?.code ?? ""),
    );
    expect(stored.codeDigest).not.toBe(authorization?.code);

    const exchange = {
      code: authorization?.code ?? "",
      clientId: client.clientId,
      redirectUri: request(client.clientId).redirectUri,
      codeVerifier: verifier,
    };
    expect((await exchangeOAuthAuthorizationCode(exchange))?.id).toBe(user.id);
    expect(await exchangeOAuthAuthorizationCode(exchange)).toBeNull();
  });

  test("does not consume a code for an invalid binding", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const client = await fixtures.OAuthClient();
    const authorization = await issueOAuthAuthorizationCode({
      request: request(client.clientId),
      user,
    });
    const code = authorization?.code ?? "";

    expect(
      await exchangeOAuthAuthorizationCode({
        code,
        clientId: client.clientId,
        redirectUri: request(client.clientId).redirectUri,
        codeVerifier: `${verifier}x`,
      }),
    ).toBeNull();
    expect(
      await exchangeOAuthAuthorizationCode({
        code,
        clientId: client.clientId,
        redirectUri: "http://127.0.0.1:45678/other",
        codeVerifier: verifier,
      }),
    ).toBeNull();
    expect(
      (
        await exchangeOAuthAuthorizationCode({
          code,
          clientId: client.clientId,
          redirectUri: request(client.clientId).redirectUri,
          codeVerifier: verifier,
        })
      )?.id,
    ).toBe(user.id);
  });

  test("rejects expired codes and deactivated clients", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const client = await fixtures.OAuthClient();
    const issuedAt = new Date("2030-01-01T00:00:00.000Z");
    const expired = await issueOAuthAuthorizationCode({
      request: request(client.clientId),
      user,
      now: issuedAt,
    });

    expect(
      await exchangeOAuthAuthorizationCode(
        {
          code: expired?.code ?? "",
          clientId: client.clientId,
          redirectUri: request(client.clientId).redirectUri,
          codeVerifier: verifier,
        },
        db,
        new Date("2030-01-01T00:03:00.000Z"),
      ),
    ).toBeNull();

    const fresh = await issueOAuthAuthorizationCode({
      request: request(client.clientId),
      user,
    });
    await db
      .update(oauthClients)
      .set({ active: false })
      .where(eq(oauthClients.id, client.id));
    expect(
      await exchangeOAuthAuthorizationCode({
        code: fresh?.code ?? "",
        clientId: client.clientId,
        redirectUri: request(client.clientId).redirectUri,
        codeVerifier: verifier,
      }),
    ).toBeNull();
  });

  test("allows only one concurrent exchange", async ({ fixtures }) => {
    const user = await fixtures.User();
    const client = await fixtures.OAuthClient();
    const authorization = await issueOAuthAuthorizationCode({
      request: request(client.clientId),
      user,
    });
    const exchange = {
      code: authorization?.code ?? "",
      clientId: client.clientId,
      redirectUri: request(client.clientId).redirectUri,
      codeVerifier: verifier,
    };

    const results = await Promise.all([
      exchangeOAuthAuthorizationCode(exchange),
      exchangeOAuthAuthorizationCode(exchange),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
