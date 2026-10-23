import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { passkeys, users } from "@peated/server/db/schema";
import {
  auditRecoveryFailure,
  findRecoveryTokenUser,
} from "@peated/server/lib/accountRecovery";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import {
  createAccessToken,
  generatePasswordHash,
  verifyToken,
} from "@peated/server/lib/auth";
import { logError } from "@peated/server/lib/log";
import {
  createPasskeyRecord,
  verifyPasskeyRegistration,
} from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import {
  AuthSchema,
  PasskeyRegistrationResponseSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

export type RecoveryPasskeyServices = {
  verifyRegistration: typeof verifyPasskeyRegistration;
  verifyToken: typeof verifyToken;
};

const defaultServices: RecoveryPasskeyServices = {
  verifyRegistration: verifyPasskeyRegistration,
  verifyToken,
};

export function createRecoveryPasskeyConfirmProcedure(
  services: RecoveryPasskeyServices = defaultServices,
) {
  return procedure
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
        passkeyResponse: PasskeyRegistrationResponseSchema,
        signedChallenge: z
          .string()
          .describe("Signed challenge from passkey options"),
      }),
    )
    .output(AuthSchema)
    .handler(async function ({ input, context, errors }) {
      try {
        const request = {
          flow: "passkey" as const,
          ip: context.ip,
          userAgent: context.userAgent,
        };
        const user = await findRecoveryTokenUser(
          input.token,
          request,
          services.verifyToken,
        );

        // Verify the passkey registration response
        let verification;
        try {
          verification = await services.verifyRegistration(
            input.passkeyResponse,
            input.signedChallenge,
          );
        } catch (err: any) {
          auditRecoveryFailure(request, "passkey_verification_failed", user.id);
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
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: { flow: "passkey", passkeyId: passkey.id },
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

        logError(error, {
          extra: {
            name: "auth/recovery/confirm-passkey",
          },
        });

        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to recover account with passkey.",
        });
      }
    });
}

export default createRecoveryPasskeyConfirmProcedure();
