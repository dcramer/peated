import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import {
  createPasskeyRecord,
  verifyPasskeyRegistration,
} from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit, requireAuth } from "@peated/server/orpc/middleware";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/auth/passkey/register/verify",
    summary: "Verify passkey registration",
    description: "Verify WebAuthn passkey registration response",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyRegisterVerify",
    }),
  })
  .input(
    z.object({
      response: z
        .custom<RegistrationResponseJSON>()
        .describe("WebAuthn registration response"),
      signedChallenge: z.string().describe("Signed challenge from options"),
      nickname: z
        .string()
        .trim()
        .min(1, "Nickname must not be empty")
        .max(100, "Nickname must be 100 characters or less")
        .regex(
          /^[^<>]*$/,
          "Nickname cannot contain HTML tags or script content",
        )
        .optional()
        .describe("Optional nickname for passkey"),
    }),
  )
  .output(
    z.object({
      verified: z.boolean(),
      passkeyId: z.number().optional(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    // Verify the passkey registration response
    let verification;
    try {
      verification = await verifyPasskeyRegistration(
        input.response,
        input.signedChallenge,
      );
    } catch (err: any) {
      throw errors.UNAUTHORIZED({
        message: err.message || "Failed to verify passkey registration",
      });
    }

    // Create the passkey record - rely on DB unique constraint for duplicate prevention
    let passkey;
    try {
      passkey = await createPasskeyRecord(
        user.id,
        input.response,
        verification.credential,
        input.nickname,
      );
    } catch (err: any) {
      if (
        err?.code === "23505" &&
        err?.constraint === "passkey_credential_id_unq"
      ) {
        throw errors.CONFLICT({
          message: "This passkey is already registered.",
        });
      }
      throw err;
    }

    auditLog({
      event: AuditEvent.PASSKEY_REGISTERED,
      userId: user.id,
      metadata: { passkeyId: passkey.id, nickname: input.nickname },
    });

    return {
      verified: true,
      passkeyId: passkey.id,
    };
  });
