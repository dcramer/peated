import { createRouterClient } from "@orpc/server";
import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import {
  createPasskeyAuthenticateVerifyProcedure,
  type PasskeyAuthenticationServices,
} from "@peated/server/orpc/routes/auth/passkey/authenticate-verify";
import type { Base64URLString } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const verifyChallenge =
  vi.fn<PasskeyAuthenticationServices["verifyChallenge"]>();
const verifyAuthenticationResponse =
  vi.fn<PasskeyAuthenticationServices["verifyResponse"]>();
const authenticateClient = createRouterClient(
  {
    authenticateVerify: createPasskeyAuthenticateVerifyProcedure({
      verifyChallenge,
      verifyResponse: verifyAuthenticationResponse,
    }),
  },
  { context: { ip: "127.0.0.1", user: null } },
);

function base64Url(value: string): Base64URLString {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Expected a base64url value");
  }
  // SAFETY: The regular expression above enforces the Base64URLString character set.
  return value as Base64URLString;
}

type ClientData = {
  type: string;
  challenge: string;
  origin: string;
};

function clientDataJson(value: ClientData): Base64URLString {
  return base64Url(Buffer.from(JSON.stringify(value)).toString("base64url"));
}

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
        clientDataJSON: clientDataJson({
          type: "webauthn.get",
          challenge: "test-challenge",
          origin: "http://localhost:3200",
        }),
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    verifyChallenge.mockResolvedValue();
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 1,
        credentialID: base64Url(passkey.credentialId),
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3200",
        rpID: "localhost",
      },
    });

    const result = await authenticateClient.authenticateVerify({
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
        clientDataJSON: clientDataJson({
          type: "webauthn.get",
          challenge: "test-challenge",
          origin: "http://localhost:3200",
        }),
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    verifyChallenge.mockResolvedValue();
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 5, // Same as current counter - replay attack!
        credentialID: base64Url(passkey.credentialId),
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3200",
        rpID: "localhost",
      },
    });

    const err = await waitError(
      authenticateClient.authenticateVerify({
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
        clientDataJSON: clientDataJson({
          type: "webauthn.get",
          challenge: "test-challenge",
          origin: "http://localhost:3200",
        }),
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    verifyChallenge.mockResolvedValue();

    const err = await waitError(
      authenticateClient.authenticateVerify({
        response: mockResponse,
        signedChallenge: "signed-challenge-token",
      }),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: No account found for this passkey. The passkey may have been registered with a different account, or the account may have been deleted.]`,
    );
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
        clientDataJSON: clientDataJson({
          type: "webauthn.get",
          challenge: "test-challenge",
          origin: "http://localhost:3200",
        }),
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    verifyChallenge.mockResolvedValue();
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 1,
        credentialID: base64Url(passkey.credentialId),
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3200",
        rpID: "localhost",
      },
    });

    const err = await waitError(
      authenticateClient.authenticateVerify({
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
        clientDataJSON: clientDataJson({
          type: "webauthn.get",
          challenge: "test-challenge",
          origin: "http://localhost:3200",
        }),
        authenticatorData: "mock-auth-data",
        signature: "mock-signature",
      },
    };

    verifyChallenge.mockRejectedValue(new Error("Invalid challenge"));

    const err = await waitError(
      authenticateClient.authenticateVerify({
        response: mockResponse,
        signedChallenge: "invalid-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid challenge]`);
  });
});
