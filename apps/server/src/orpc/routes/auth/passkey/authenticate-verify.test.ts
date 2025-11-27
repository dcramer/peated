import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { verifyChallenge } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock WebAuthn and auth functions
vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock("@peated/server/lib/auth", async () => {
  const actual = await vi.importActual("@peated/server/lib/auth");
  return {
    ...actual,
    verifyChallenge: vi.fn(),
  };
});

describe("POST /auth/passkey/authenticate/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("authenticates with valid passkey", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const passkey = await fixtures.Passkey({ userId: user.id, counter: 0 });

    const mockResponse = {
      id: passkey.credentialId,
      rawId: passkey.credentialId,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({
            type: "webauthn.get",
            challenge: "test-challenge",
            origin: "http://localhost:3000",
          }),
        ).toString("base64") as any,
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    vi.mocked(verifyChallenge).mockResolvedValue();
    vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 1,
        credentialID: passkey.credentialId as any,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });

    const result = await routerClient.auth.passkey.authenticateVerify({
      response: mockResponse,
      signedChallenge: "signed-challenge-token",
    });

    expect(result.user.id).toBe(user.id);
    expect(result.accessToken).toBeDefined();

    // Verify counter was updated
    const [updatedPasskey] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));
    expect(updatedPasskey.counter).toBe(1);
  });

  test("rejects replay attack - same counter", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const passkey = await fixtures.Passkey({ userId: user.id, counter: 5 });

    const mockResponse = {
      id: passkey.credentialId,
      rawId: passkey.credentialId,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({
            type: "webauthn.get",
            challenge: "test-challenge",
            origin: "http://localhost:3000",
          }),
        ).toString("base64") as any,
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    vi.mocked(verifyChallenge).mockResolvedValue();
    vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 5, // Same as current counter - replay attack!
        credentialID: passkey.credentialId as any,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });

    const err = await waitError(
      routerClient.auth.passkey.authenticateVerify({
        response: mockResponse,
        signedChallenge: "signed-challenge-token",
      }),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Passkey counter validation failed. Possible replay attack detected.]`,
    );
  });

  test("rejects passkey not found", async ({ fixtures }) => {
    const mockResponse = {
      id: "non-existent-credential",
      rawId: "non-existent-credential",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({
            type: "webauthn.get",
            challenge: "test-challenge",
            origin: "http://localhost:3000",
          }),
        ).toString("base64") as any,
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    vi.mocked(verifyChallenge).mockResolvedValue();

    const err = await waitError(
      routerClient.auth.passkey.authenticateVerify({
        response: mockResponse,
        signedChallenge: "signed-challenge-token",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Passkey not found]`);
  });

  test("rejects inactive user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });
    const passkey = await fixtures.Passkey({ userId: user.id, counter: 0 });

    const mockResponse = {
      id: passkey.credentialId,
      rawId: passkey.credentialId,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({
            type: "webauthn.get",
            challenge: "test-challenge",
            origin: "http://localhost:3000",
          }),
        ).toString("base64") as any,
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    vi.mocked(verifyChallenge).mockResolvedValue();
    vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 1,
        credentialID: passkey.credentialId as any,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });

    const err = await waitError(
      routerClient.auth.passkey.authenticateVerify({
        response: mockResponse,
        signedChallenge: "signed-challenge-token",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid credentials.]`);
  });

  test("rejects invalid challenge", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const passkey = await fixtures.Passkey({ userId: user.id });

    const mockResponse = {
      id: passkey.credentialId,
      rawId: passkey.credentialId,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({
            type: "webauthn.get",
            challenge: "test-challenge",
            origin: "http://localhost:3000",
          }),
        ).toString("base64") as any,
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    vi.mocked(verifyChallenge).mockRejectedValue(
      new Error("Invalid challenge"),
    );

    const err = await waitError(
      routerClient.auth.passkey.authenticateVerify({
        response: mockResponse,
        signedChallenge: "invalid-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid challenge]`);
  });
});
