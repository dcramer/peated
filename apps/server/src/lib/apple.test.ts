import {
  APPLE_ISSUER,
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  AppleIdentityTokenError,
  AppleRevocationError,
  revokeAppleAuthorization,
  verifyAppleIdentityToken,
} from "@peated/server/lib/apple";
import waitError from "@peated/server/lib/test/waitError";
import {
  createLocalJWKSet,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWTVerifyGetKey,
  type KeyObject,
} from "jose";
import { beforeAll, describe, expect, test } from "vitest";

const CLIENT_ID = "com.peated.Peated";

type SigningKey = CryptoKey | KeyObject;

let privateKey: SigningKey;
let getKey: JWTVerifyGetKey;
let otherPrivateKey: SigningKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  getKey = createLocalJWKSet({
    keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }],
  });

  const otherPair = await generateKeyPair("RS256");
  otherPrivateKey = otherPair.privateKey;
});

function signToken({
  claims = {},
  issuer = APPLE_ISSUER,
  audience = CLIENT_ID,
  subject = "001234.abcdef.5678",
  issuedAt = Math.floor(Date.now() / 1000),
  expiresAt = issuedAt + 600,
  key = privateKey,
}: {
  claims?: { email?: string; email_verified?: boolean | string };
  issuer?: string;
  audience?: string;
  subject?: string;
  issuedAt?: number;
  expiresAt?: number;
  key?: SigningKey;
} = {}) {
  return new SignJWT({ email: "user@example.com", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);
}

describe("verifyAppleIdentityToken", () => {
  test("returns the identity from a valid token", async () => {
    const token = await signToken({
      claims: {
        email: "abc123@privaterelay.appleid.com",
        email_verified: "true",
      },
    });

    const identity = await verifyAppleIdentityToken(token, {
      clientIds: [CLIENT_ID],
      getKey,
    });

    expect(identity).toEqual({
      sub: "001234.abcdef.5678",
      email: "abc123@privaterelay.appleid.com",
      emailVerified: true,
    });
  });

  test("reads a boolean email_verified claim", async () => {
    const token = await signToken({ claims: { email_verified: true } });

    const identity = await verifyAppleIdentityToken(token, {
      clientIds: [CLIENT_ID],
      getKey,
    });

    expect(identity.emailVerified).toBe(true);
  });

  test("treats a missing email as unverified", async () => {
    const token = await signToken({ claims: { email: undefined } });

    const identity = await verifyAppleIdentityToken(token, {
      clientIds: [CLIENT_ID],
      getKey,
    });

    expect(identity.email).toBeNull();
    expect(identity.emailVerified).toBe(false);
  });

  test("rejects a token for another app", async () => {
    const token = await signToken({ audience: "com.example.Other" });

    await expect(
      verifyAppleIdentityToken(token, { clientIds: [CLIENT_ID], getKey }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  test("rejects a token from another issuer", async () => {
    const token = await signToken({ issuer: "https://accounts.google.com" });

    await expect(
      verifyAppleIdentityToken(token, { clientIds: [CLIENT_ID], getKey }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  test("rejects a token signed with an unknown key", async () => {
    const token = await signToken({ key: otherPrivateKey });

    await expect(
      verifyAppleIdentityToken(token, { clientIds: [CLIENT_ID], getKey }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  test("rejects an expired token", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 3600;
    const token = await signToken({ issuedAt, expiresAt: issuedAt + 600 });

    await expect(
      verifyAppleIdentityToken(token, { clientIds: [CLIENT_ID], getKey }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  test("rejects a token older than five minutes", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 400;
    const token = await signToken({ issuedAt, expiresAt: issuedAt + 600 });

    await expect(
      verifyAppleIdentityToken(token, { clientIds: [CLIENT_ID], getKey }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  test("rejects garbage", async () => {
    await expect(
      verifyAppleIdentityToken("not-a-jwt", { clientIds: [CLIENT_ID], getKey }),
    ).rejects.toBeInstanceOf(AppleIdentityTokenError);
  });

  test("fails when no client IDs are configured", async () => {
    const token = await signToken();

    await expect(
      verifyAppleIdentityToken(token, { clientIds: [], getKey }),
    ).rejects.toThrow("No Apple client IDs configured.");
  });
});

describe("revokeAppleAuthorization", () => {
  const revocationConfig = {
    clientId: CLIENT_ID,
    teamId: "TEAM123456",
    keyId: "KEY1234567",
    privateKey: "",
  };
  let secretPublicKey: SigningKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("ES256", { extractable: true });
    revocationConfig.privateKey = await exportPKCS8(pair.privateKey);
    secretPublicKey = pair.publicKey;
  });

  function appleServer(responses: Array<() => Response>) {
    const requests: { url: string; form: Record<string, string> }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        url: input instanceof Request ? input.url : input.toString(),
        form: Object.fromEntries(
          init?.body instanceof URLSearchParams ? init.body : [],
        ),
      });
      const respond = responses.shift();
      if (!respond) throw new Error("Unexpected request to Apple.");
      return respond();
    };
    return { fetchImpl, requests };
  }

  test("exchanges the code and revokes the refresh token", async () => {
    const { fetchImpl, requests } = appleServer([
      () =>
        Response.json({ access_token: "access-1", refresh_token: "refresh-1" }),
      () => new Response(null, { status: 200 }),
    ]);

    await revokeAppleAuthorization("code-1", {
      config: revocationConfig,
      fetch: fetchImpl,
    });

    expect(requests.map((request) => request.url)).toEqual([
      APPLE_TOKEN_URL,
      APPLE_REVOKE_URL,
    ]);
    expect(requests[0].form).toMatchObject({
      client_id: CLIENT_ID,
      code: "code-1",
      grant_type: "authorization_code",
    });
    expect(requests[1].form).toMatchObject({
      client_id: CLIENT_ID,
      token: "refresh-1",
      token_type_hint: "refresh_token",
    });
    expect(requests[1].form.client_secret).toEqual(
      requests[0].form.client_secret,
    );

    const { payload, protectedHeader } = await jwtVerify(
      requests[0].form.client_secret,
      secretPublicKey,
      { issuer: "TEAM123456", audience: APPLE_ISSUER, subject: CLIENT_ID },
    );
    expect(protectedHeader).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    expect(payload.exp! - payload.iat!).toBe(5 * 60);
  });

  test("revokes the access token when no refresh token is returned", async () => {
    const { fetchImpl, requests } = appleServer([
      () => Response.json({ access_token: "access-1" }),
      () => new Response(null, { status: 200 }),
    ]);

    await revokeAppleAuthorization("code-1", {
      config: revocationConfig,
      fetch: fetchImpl,
    });

    expect(requests[1].form).toMatchObject({
      token: "access-1",
      token_type_hint: "access_token",
    });
  });

  test("reports a rejected code as not retryable", async () => {
    const { fetchImpl } = appleServer([
      () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    ]);

    const err = await waitError(
      () =>
        revokeAppleAuthorization("code-1", {
          config: revocationConfig,
          fetch: fetchImpl,
        }),
      AppleRevocationError,
    );
    expect(err.retryable).toBe(false);
    expect(err.message).toMatchInlineSnapshot(
      `"Apple rejected the request: invalid_grant."`,
    );
  });

  test("reports an Apple outage as retryable", async () => {
    const { fetchImpl } = appleServer([
      () => new Response(null, { status: 503 }),
    ]);

    const err = await waitError(
      () =>
        revokeAppleAuthorization("code-1", {
          config: revocationConfig,
          fetch: fetchImpl,
        }),
      AppleRevocationError,
    );
    expect(err.retryable).toBe(true);
    expect(err.message).toMatchInlineSnapshot(
      `"Apple rejected the request: HTTP 503."`,
    );
  });

  test("reports a network failure as retryable", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const err = await waitError(
      () =>
        revokeAppleAuthorization("code-1", {
          config: revocationConfig,
          fetch: fetchImpl,
        }),
      AppleRevocationError,
    );
    expect(err.retryable).toBe(true);
    expect(err.cause).toBeInstanceOf(TypeError);
  });

  test("needs server credentials", async () => {
    const err = await waitError(() =>
      revokeAppleAuthorization("code-1", { config: null }),
    );
    expect(err.message).toMatchInlineSnapshot(
      `"Sign in with Apple server credentials are not configured."`,
    );
  });
});
