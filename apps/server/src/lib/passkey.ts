import config from "@peated/server/config";
import type { AnyDatabase } from "@peated/server/db";
import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { signChallenge, verifyChallenge } from "@peated/server/lib/auth";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";

// Extract the origin and RP ID from URL_PREFIX
const url = new URL(config.URL_PREFIX);
export const rpID = url.hostname;
export const rpName = "Peated";
export const origin = config.URL_PREFIX;

// Expected origin could vary based on environment
export const expectedOrigin = origin;

// WebAuthn client data JSON schema (as per WebAuthn spec)
// https://www.w3.org/TR/webauthn-2/#dictdef-collectedclientdata
export const ClientDataJSONSchema = z.object({
  type: z.string(),
  challenge: z.string(),
  origin: z.string(),
  crossOrigin: z.boolean().optional(),
});

// Type for credentials to exclude during registration (string-based IDs from our database)
export interface ExcludeCredential {
  id: string;
  transports?: AuthenticatorTransportFuture[] | null;
}

/**
 * Generate WebAuthn registration options with a signed challenge
 * This is used for all passkey registration flows (new user, add passkey, recovery)
 */
export async function generatePasskeyChallenge(options: {
  username: string;
  userDisplayName?: string;
  userID?: Uint8Array | string | number;
  excludeCredentials?: ExcludeCredential[];
}): Promise<{
  options: PublicKeyCredentialCreationOptionsJSON;
  signedChallenge: string;
}> {
  // Convert userID to Uint8Array if it's a string or number
  let userID: Uint8Array | undefined;
  if (options.userID !== undefined) {
    if (options.userID instanceof Uint8Array) {
      userID = options.userID;
    } else {
      userID = new TextEncoder().encode(options.userID.toString());
    }
  }

  // Map credentials for the library (filter out null transports)
  const excludeCredentials = options.excludeCredentials?.map((cred) => ({
    id: cred.id,
    transports: cred.transports ?? undefined,
  }));

  const registrationOptions = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: options.username,
    userDisplayName: options.userDisplayName || options.username,
    userID,
    excludeCredentials,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const signedChallenge = await signChallenge(registrationOptions.challenge);

  return {
    options: registrationOptions,
    signedChallenge,
  };
}

/**
 * Verify a passkey registration response
 * Extracts and validates the signed challenge, then verifies the WebAuthn response
 */
export async function verifyPasskeyRegistration(
  passkeyResponse: RegistrationResponseJSON,
  signedChallenge: string,
): Promise<{
  verified: boolean;
  credential: {
    publicKey: Uint8Array;
    counter: number;
    transports?: (
      | "ble"
      | "cable"
      | "hybrid"
      | "internal"
      | "nfc"
      | "smart-card"
      | "usb"
    )[];
  };
}> {
  // Extract and validate challenge from client data JSON
  // Safe property access - the full validation happens in verifyRegistrationResponse below
  const clientDataJSONBase64 = passkeyResponse?.response?.clientDataJSON;
  if (!clientDataJSONBase64) {
    throw new Error("Missing clientDataJSON in credential response");
  }

  let clientDataJSON;
  try {
    const rawJSON = JSON.parse(
      Buffer.from(clientDataJSONBase64, "base64").toString(),
    );
    clientDataJSON = ClientDataJSONSchema.parse(rawJSON);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(
        `Invalid client data JSON: ${err.errors.map((e) => e.message).join(", ")}`,
      );
    }
    throw new Error("Invalid client data JSON format");
  }

  const challenge = clientDataJSON.challenge;

  // Verify the signed challenge to prevent tampering and replay attacks
  try {
    await verifyChallenge(signedChallenge, challenge);
  } catch (err: any) {
    throw new Error(err.message || "Invalid challenge");
  }

  // Verify the WebAuthn registration response
  // Pass the original passkeyResponse to the library for full validation
  const verification = await verifyRegistrationResponse({
    response: passkeyResponse,
    expectedChallenge: challenge,
    expectedOrigin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Failed to verify passkey registration");
  }

  return {
    verified: verification.verified,
    credential: {
      publicKey: verification.registrationInfo.credential.publicKey,
      counter: verification.registrationInfo.credential.counter,
      transports: verification.registrationInfo.credential.transports,
    },
  };
}

/**
 * Create a passkey record in the database
 * Used after successful passkey registration verification
 */
export async function createPasskeyRecord(
  userId: number,
  passkeyResponse: RegistrationResponseJSON,
  credential: {
    publicKey: Uint8Array;
    counter: number;
    transports?: (
      | "ble"
      | "cable"
      | "hybrid"
      | "internal"
      | "nfc"
      | "smart-card"
      | "usb"
    )[];
  },
  nickname?: string | null,
  dbConn: AnyDatabase = db,
): Promise<{ id: number }> {
  // Validate credential ID exists
  const credentialId = passkeyResponse?.id;
  if (!credentialId) {
    throw new Error("Missing credential ID in passkey response");
  }

  const [passkey] = await dbConn
    .insert(passkeys)
    .values({
      userId,
      credentialId,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
      nickname,
    })
    .returning();

  return passkey;
}
