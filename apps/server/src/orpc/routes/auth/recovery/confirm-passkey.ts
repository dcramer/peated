import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { passkeys, users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import {
  createAccessToken,
  generatePasswordHash,
  verifyPayload,
} from "@peated/server/lib/auth";
import { logError } from "@peated/server/lib/log";
import {
  createPasskeyRecord,
  verifyPasskeyRegistration,
} from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { AuthSchema, PasswordResetSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const TOKEN_CUTOFF = 600; // 10 minutes

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/recovery/passkey/confirm",
    summary: "Confirm account recovery with passkey",
    description:
      "Confirm account recovery using token from email and add a new passkey. Automatically verifies the user account",
    spec: (spec) => ({
      ...spec,
      operationId: "confirmRecoveryPasskey",
    }),
  })
  .input(
    z.object({
      token: z.string(),
      passkeyResponse: z
        .custom<RegistrationResponseJSON>()
        .describe("WebAuthn registration response"),
      signedChallenge: z
        .string()
        .describe("Signed challenge from passkey options"),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input, errors }) {
    try {
      // Verify the recovery token
      let payload;
      try {
        payload = await verifyPayload(input.token);
      } catch (err) {
        throw errors.BAD_REQUEST({
          message: "Invalid verification token.",
        });
      }

      const token = PasswordResetSchema.parse(payload);
      if (
        new Date(token.createdAt).getTime() <
        new Date().getTime() - TOKEN_CUTOFF * 1000
      ) {
        throw errors.BAD_REQUEST({
          message: "Token has expired.",
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, token.id),
            eq(sql`LOWER(${users.email})`, token.email.toLowerCase()),
          ),
        );
      if (!user) {
        throw errors.BAD_REQUEST({
          message: "Invalid verification token.",
        });
      }

      // Verify password hash digest using SHA-256 and constant-time comparison
      const expectedDigest = createHash("sha256")
        .update(user.passwordHash || "")
        .digest();
      const providedDigest = Buffer.from(token.digest, "hex");

      if (
        expectedDigest.length !== providedDigest.length ||
        !timingSafeEqual(expectedDigest, providedDigest)
      ) {
        throw errors.BAD_REQUEST({
          message: "Invalid verification token.",
        });
      }

      // Verify the passkey registration response
      let verification;
      try {
        verification = await verifyPasskeyRegistration(
          input.passkeyResponse,
          input.signedChallenge,
        );
      } catch (err: any) {
        throw errors.UNAUTHORIZED({
          message: err.message || "Failed to verify passkey registration",
        });
      }

      // Add the passkey and mark user as verified
      // DB unique constraint will prevent duplicate passkey registration
      let passkey;
      let updatedUser;
      try {
        const result = await db.transaction(async (tx) => {
          // Add passkey
          const passkey = await createPasskeyRecord(
            user.id,
            input.passkeyResponse,
            verification.credential,
            "Recovery passkey",
            tx,
          );

          // Mark user as verified and invalidate the recovery token
          // Set passwordHash to a crypto-secure random value to ensure token digest changes
          // This prevents token reuse even if user had no password before
          const [updated] = await tx
            .update(users)
            .set({
              verified: true,
              passwordHash: generatePasswordHash(
                `INVALIDATED_${randomBytes(32).toString("hex")}`,
              ),
            })
            .where(eq(users.id, user.id))
            .returning();

          return { passkey, updatedUser: updated };
        });

        passkey = result.passkey;
        updatedUser = result.updatedUser;
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
        event: AuditEvent.RECOVERY_SUCCESS,
        userId: user.id,
        metadata: { passkeyId: passkey.id },
      });

      auditLog({
        event: AuditEvent.PASSKEY_REGISTERED,
        userId: user.id,
        metadata: { passkeyId: passkey.id, flow: "recovery" },
      });

      return {
        user: await serialize(UserSerializer, updatedUser, updatedUser),
        accessToken: await createAccessToken(updatedUser),
      };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      logError(error as Error, {
        context: {
          name: "auth/recovery/confirm-passkey",
        },
      });

      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to recover account with passkey.",
      });
    }
  });
