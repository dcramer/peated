import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { verifyPasskeyRegistration } from "@peated/server/lib/passkey";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock passkey verification
vi.mock("@peated/server/lib/passkey", async () => {
  const actual = await vi.importActual("@peated/server/lib/passkey");
  return {
    ...actual,
    verifyPasskeyRegistration: vi.fn(),
  };
});

describe("POST /auth/passkey/register/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.auth.passkey.registerVerify({
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

    vi.mocked(verifyPasskeyRegistration).mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
    });

    const result = await routerClient.auth.passkey.registerVerify(
      {
        response: mockResponse,
        signedChallenge: "signed-challenge",
        nickname: "My Phone",
      },
      { context: { user } },
    );

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

    vi.mocked(verifyPasskeyRegistration).mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["usb"],
      },
    });

    const result = await routerClient.auth.passkey.registerVerify(
      {
        response: mockResponse,
        signedChallenge: "signed-challenge",
      },
      { context: { user } },
    );

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

    vi.mocked(verifyPasskeyRegistration).mockResolvedValue({
      verified: true,
      credential: {
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ["internal"],
      },
    });

    const err = await waitError(
      routerClient.auth.passkey.registerVerify(
        {
          response: mockResponse,
          signedChallenge: "signed-challenge",
        },
        { context: { user } },
      ),
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

    vi.mocked(verifyPasskeyRegistration).mockRejectedValue(
      new Error("Invalid attestation"),
    );

    const err = await waitError(
      routerClient.auth.passkey.registerVerify(
        {
          response: mockResponse,
          signedChallenge: "signed-challenge",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid attestation]`);
  });
});
