import { createRouterClient } from "@orpc/server";
import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import type { Context } from "@peated/server/orpc/context";
import {
  createPasskeyRegisterVerifyProcedure,
  type PasskeyRegistrationVerifier,
} from "@peated/server/orpc/routes/auth/passkey/register-verify";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const verifyPasskeyRegistration = vi.fn<PasskeyRegistrationVerifier>();

function createRegisterClient(context: Context) {
  return createRouterClient(
    {
      registerVerify: createPasskeyRegisterVerifyProcedure(
        verifyPasskeyRegistration,
      ),
    },
    { context },
  );
}

describe("POST /auth/passkey/register/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requires authentication", async () => {
    const err = await waitError(
      createRegisterClient({ user: null, ip: "127.0.0.1" }).registerVerify({
        response: {
          id: "test-id",
          rawId: "test-id",
          type: "public-key" as const,
          clientExtensionResults: {},
          response: {
            clientDataJSON: "mock-client-data",
            attestationObject: "mock-attestation",
          },
        },
        signedChallenge: "test",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("registers new passkey for user", async ({ fixtures }) => {
    const user = await fixtures.User();

    const mockResponse = {
      id: "new-credential-id",
      rawId: "new-credential-id",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "mock-client-data",
        attestationObject: "mock-attestation",
      },
    };

    verifyPasskeyRegistration.mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
    });

    const result = await createRegisterClient({ user }).registerVerify({
      response: mockResponse,
      signedChallenge: "signed-challenge",
      nickname: "My Phone",
    });

    expect(result.verified).toBe(true);

    // Verify passkey was created in database
    const userPasskeys = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.userId, user.id));

    expect(userPasskeys).toHaveLength(1);
    expect(userPasskeys[0].credentialId).toBe("new-credential-id");
    expect(userPasskeys[0].nickname).toBe("My Phone");
  });

  test("registers passkey without nickname", async ({ fixtures }) => {
    const user = await fixtures.User();

    const mockResponse = {
      id: "new-credential-id-2",
      rawId: "new-credential-id-2",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "mock-client-data",
        attestationObject: "mock-attestation",
      },
    };

    verifyPasskeyRegistration.mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["usb"],
      },
    });

    const result = await createRegisterClient({ user }).registerVerify({
      response: mockResponse,
      signedChallenge: "signed-challenge",
    });

    expect(result.verified).toBe(true);

    const userPasskeys = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.userId, user.id));

    expect(userPasskeys[0].nickname).toBeNull();
  });

  test("rejects duplicate credential", async ({ fixtures }) => {
    const user = await fixtures.User();
    const existingPasskey = await fixtures.Passkey({ userId: user.id });

    const mockResponse = {
      id: existingPasskey.credentialId,
      rawId: existingPasskey.credentialId,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "mock-client-data",
        attestationObject: "mock-attestation",
      },
    };

    verifyPasskeyRegistration.mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
    });

    const err = await waitError(
      createRegisterClient({ user }).registerVerify({
        response: mockResponse,
        signedChallenge: "signed-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: This passkey is already registered.]`,
    );
  });

  test("rejects when verification fails", async ({ fixtures }) => {
    const user = await fixtures.User();

    const mockResponse = {
      id: "new-credential-id",
      rawId: "new-credential-id",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "mock-client-data",
        attestationObject: "mock-attestation",
      },
    };

    verifyPasskeyRegistration.mockRejectedValue(
      new Error("Invalid attestation"),
    );

    const err = await waitError(
      createRegisterClient({ user }).registerVerify({
        response: mockResponse,
        signedChallenge: "signed-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid attestation]`);
  });
});
