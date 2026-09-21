import {
  APPLE_ISSUER,
  AppleIdentityTokenError,
  verifyAppleIdentityToken,
} from "@peated/server/lib/apple";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
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
