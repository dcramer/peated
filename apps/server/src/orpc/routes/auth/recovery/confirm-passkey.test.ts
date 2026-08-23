import { createRouterClient } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import {
  createRecoveryPasskeyConfirmProcedure,
  type RecoveryPasskeyServices,
} from "@peated/server/orpc/routes/auth/recovery/confirm-passkey";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const verifyPayload = vi.fn<RecoveryPasskeyServices["verifyToken"]>();
const verifyPasskeyRegistration =
  vi.fn<RecoveryPasskeyServices["verifyRegistration"]>();
const confirmPasskeyClient = createRouterClient(
  {
    confirmPasskey: createRecoveryPasskeyConfirmProcedure({
      verifyRegistration: verifyPasskeyRegistration,
      verifyToken: verifyPayload,
    }),
  },
  { context: { ip: "127.0.0.1", user: null } },
);

describe("POST /auth/recovery/passkey/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("recovers account and adds passkey", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false, passwordHash: null });

    // Generate digest for the user's current password hash
    const digest = createHash("sha256")
      .update(user.passwordHash || "")
      .digest("hex");

    const mockResponse = {
      id: "recovery-credential-id",
      rawId: "recovery-credential-id",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "mock-client-data",
        attestationObject: "mock-attestation",
      },
    };

    verifyPayload.mockResolvedValue({
      id: user.id,
      email: user.email,
      digest,
      createdAt: new Date().toISOString(),
    });

    verifyPasskeyRegistration.mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
    });

    const result = await confirmPasskeyClient.confirmPasskey({
      token: "valid-recovery-token",
      passkeyResponse: mockResponse,
      signedChallenge: "signed-challenge",
    });

    expect(result.user.id).toBe(user.id);
    expect(result.user.verified).toBe(true);
    expect(result.accessToken).toBeDefined();

    // Verify user was marked as verified and password was invalidated
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    expect(updatedUser.verified).toBe(true);
    expect(updatedUser.passwordHash).not.toBeNull(); // Should be hashed random value
    expect(updatedUser.passwordHash).not.toBe(user.passwordHash); // Password hash should have changed to invalidate the token
  });

  test("rejects expired token", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });

    // Generate digest for the user's current password hash
    const digest = createHash("sha256")
      .update(user.passwordHash || "")
      .digest("hex");

    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 11); // 11 minutes ago

    verifyPayload.mockResolvedValue({
      id: user.id,
      email: user.email,
      digest,
      createdAt: expiredDate.toISOString(),
    });

    const err = await waitError(
      confirmPasskeyClient.confirmPasskey({
        token: "expired-token",
        passkeyResponse: {
          id: "test-id",
          rawId: "test-id",
          type: "public-key" as const,
          clientExtensionResults: {},
          response: {
            clientDataJSON: "mock-client-data",
            attestationObject: "mock-attestation",
          },
        },
        signedChallenge: "signed-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Token has expired.]`);
  });

  test("rejects invalid token", async ({ fixtures }) => {
    verifyPayload.mockRejectedValue(new Error("Invalid token"));

    const err = await waitError(
      confirmPasskeyClient.confirmPasskey({
        token: "invalid-token",
        passkeyResponse: {
          id: "test-id",
          rawId: "test-id",
          type: "public-key" as const,
          clientExtensionResults: {},
          response: {
            clientDataJSON: "mock-client-data",
            attestationObject: "mock-attestation",
          },
        },
        signedChallenge: "signed-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid verification token.]`);
  });

  test("rejects user not found", async ({ fixtures }) => {
    verifyPayload.mockResolvedValue({
      id: 99999,
      email: "nonexistent@example.com",
      digest: "mock-digest",
      createdAt: new Date().toISOString(),
    });

    const err = await waitError(
      confirmPasskeyClient.confirmPasskey({
        token: "valid-token",
        passkeyResponse: {
          id: "test-id",
          rawId: "test-id",
          type: "public-key" as const,
          clientExtensionResults: {},
          response: {
            clientDataJSON: "mock-client-data",
            attestationObject: "mock-attestation",
          },
        },
        signedChallenge: "signed-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid verification token.]`);
  });

  test("rejects duplicate passkey credential", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });
    const existingPasskey = await fixtures.Passkey({ userId: user.id });

    // Generate digest for the user's current password hash
    const digest = createHash("sha256")
      .update(user.passwordHash || "")
      .digest("hex");

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

    verifyPayload.mockResolvedValue({
      id: user.id,
      email: user.email,
      digest,
      createdAt: new Date().toISOString(),
    });

    verifyPasskeyRegistration.mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
    });

    const err = await waitError(
      confirmPasskeyClient.confirmPasskey({
        token: "valid-token",
        passkeyResponse: mockResponse,
        signedChallenge: "signed-challenge",
      }),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: This passkey is already registered.]`,
    );
  });
});
