import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";

// WebAuthn JSON shapes from the WebAuthn Level 3 spec, as used by
// @simplewebauthn. Generated API clients, such as the iOS app, need real
// schemas here; `z.custom()` publishes an empty schema that they drop.
// https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON

const Base64URLSchema = z.string().describe("Base64url-encoded bytes");

export const PasskeyTransportSchema = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const CredentialTypeSchema = z.literal("public-key");

const UserVerificationSchema = z.enum(["discouraged", "preferred", "required"]);

const HintSchema = z.enum(["hybrid", "security-key", "client-device"]);

const AuthenticatorAttachmentSchema = z.enum(["cross-platform", "platform"]);

// Extensions Peated's WebAuthn library knows. Unknown extensions are dropped.
const ExtensionInputsSchema = z
  .object({
    appid: z.string().optional(),
    credProps: z.boolean().optional(),
    hmacCreateSecret: z.boolean().optional(),
    minPinLength: z.boolean().optional(),
  })
  .describe("WebAuthn extensions to request");

const ExtensionResultsSchema = z
  .object({
    appid: z.boolean().optional(),
    credProps: z.object({ rk: z.boolean().optional() }).optional(),
    hmacCreateSecret: z.boolean().optional(),
  })
  .describe("WebAuthn extension results from the client");

const CredentialDescriptorSchema = z.object({
  id: Base64URLSchema.describe("Credential ID"),
  type: CredentialTypeSchema,
  transports: z.array(PasskeyTransportSchema).optional(),
});

export const PasskeyCreationOptionsSchema = z
  .object({
    rp: z.object({
      id: z.string().optional().describe("Relying party ID (domain)"),
      name: z.string(),
    }),
    user: z.object({
      id: Base64URLSchema.describe("User handle"),
      name: z.string(),
      displayName: z.string(),
    }),
    challenge: Base64URLSchema,
    pubKeyCredParams: z.array(
      z.object({
        alg: z.number().int().describe("COSE algorithm identifier"),
        type: CredentialTypeSchema,
      }),
    ),
    timeout: z.number().optional().describe("Timeout in milliseconds"),
    excludeCredentials: z.array(CredentialDescriptorSchema).optional(),
    authenticatorSelection: z
      .object({
        authenticatorAttachment: AuthenticatorAttachmentSchema.optional(),
        requireResidentKey: z.boolean().optional(),
        residentKey: z
          .enum(["discouraged", "preferred", "required"])
          .optional(),
        userVerification: UserVerificationSchema.optional(),
      })
      .optional(),
    hints: z.array(HintSchema).optional(),
    attestation: z
      .enum(["direct", "enterprise", "indirect", "none"])
      .optional(),
    attestationFormats: z
      .array(
        z.enum([
          "fido-u2f",
          "packed",
          "android-safetynet",
          "android-key",
          "tpm",
          "apple",
          "none",
        ]),
      )
      .optional(),
    extensions: ExtensionInputsSchema.optional(),
  })
  .describe(
    "WebAuthn options for creating a passkey",
  ) satisfies z.ZodType<PublicKeyCredentialCreationOptionsJSON>;

export const PasskeyRequestOptionsSchema = z
  .object({
    challenge: Base64URLSchema,
    timeout: z.number().optional().describe("Timeout in milliseconds"),
    rpId: z.string().optional().describe("Relying party ID (domain)"),
    allowCredentials: z.array(CredentialDescriptorSchema).optional(),
    userVerification: UserVerificationSchema.optional(),
    hints: z.array(HintSchema).optional(),
    extensions: ExtensionInputsSchema.optional(),
  })
  .describe(
    "WebAuthn options for signing in with a passkey",
  ) satisfies z.ZodType<PublicKeyCredentialRequestOptionsJSON>;

export const PasskeyRegistrationResponseSchema = z
  .object({
    id: Base64URLSchema.describe("Credential ID"),
    rawId: Base64URLSchema.describe("Credential ID"),
    response: z.object({
      clientDataJSON: Base64URLSchema,
      attestationObject: Base64URLSchema,
      authenticatorData: Base64URLSchema.optional(),
      transports: z.array(PasskeyTransportSchema).optional(),
      publicKeyAlgorithm: z
        .number()
        .int()
        .optional()
        .describe("COSE algorithm identifier"),
      publicKey: Base64URLSchema.optional(),
    }),
    authenticatorAttachment: AuthenticatorAttachmentSchema.optional(),
    clientExtensionResults: ExtensionResultsSchema,
    type: CredentialTypeSchema,
  })
  .describe(
    "WebAuthn registration response from the authenticator",
  ) satisfies z.ZodType<RegistrationResponseJSON>;

export const PasskeyAuthenticationResponseSchema = z
  .object({
    id: Base64URLSchema.describe("Credential ID"),
    rawId: Base64URLSchema.describe("Credential ID"),
    response: z.object({
      clientDataJSON: Base64URLSchema,
      authenticatorData: Base64URLSchema,
      signature: Base64URLSchema,
      userHandle: Base64URLSchema.optional(),
    }),
    authenticatorAttachment: AuthenticatorAttachmentSchema.optional(),
    clientExtensionResults: ExtensionResultsSchema,
    type: CredentialTypeSchema,
  })
  .describe(
    "WebAuthn authentication response from the authenticator",
  ) satisfies z.ZodType<AuthenticationResponseJSON>;
