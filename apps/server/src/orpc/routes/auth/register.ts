import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { passkeys, users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import {
  createAccessToken,
  generatePasswordHash,
} from "@peated/server/lib/auth";
import { sendVerificationEmail } from "@peated/server/lib/email";
import {
  createPasskeyRecord,
  verifyPasskeyRegistration,
} from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/register",
    summary: "User registration",
    description:
      "Register a new user account with username, email, and password",
    spec: (spec) => ({
      ...spec,
      operationId: "register",
    }),
  })
  .input(
    z.object({
      username: z.string().toLowerCase(),
      email: z.string().email().toLowerCase(),
      password: z.string().optional(),
      passkeyResponse: z
        .any()
        .optional()
        .describe("WebAuthn registration response"),
      signedChallenge: z
        .string()
        .optional()
        .describe("Signed challenge from passkey options"),
      tosAccepted: z.boolean().describe("User accepted Terms of Service"),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({
    input: {
      username,
      email,
      password,
      passkeyResponse,
      signedChallenge,
      tosAccepted,
    },
    errors,
  }) {
    if (!tosAccepted) {
      throw errors.UNPROCESSABLE_ENTITY({
        message: "You must accept the Terms of Service.",
      });
    }

    // Handle passkey registration
    if (passkeyResponse && signedChallenge) {
      // Verify the passkey registration response
      let verification;
      try {
        verification = await verifyPasskeyRegistration(
          passkeyResponse,
          signedChallenge,
        );
      } catch (err: any) {
        throw errors.UNAUTHORIZED({
          message: err.message || "Failed to verify passkey registration",
        });
      }

      // Create user and passkey in a transaction
      // DB unique constraint will prevent duplicate passkey registration
      const [user, newPasskey] = await db.transaction(async (tx) => {
        let newUser;
        try {
          [newUser] = await tx
            .insert(users)
            .values({
              username,
              email,
              passwordHash: null,
              verified: !!config.SKIP_EMAIL_VERIFICATION,
              termsAcceptedAt: sql`NOW()` as unknown as Date,
            })
            .returning();
        } catch (err: any) {
          if (
            err?.code === "23505" &&
            (err?.constraint === "user_username_unq" ||
              err?.constraint === "user_email_unq")
          ) {
            const fieldName =
              err.constraint === "user_username_unq" ? "username" : "email";
            throw errors.CONFLICT({
              message: `An account with this ${fieldName} already exists.`,
            });
          }
          throw err;
        }

        // Store the passkey
        let newPasskey;
        try {
          newPasskey = await createPasskeyRecord(
            newUser.id,
            passkeyResponse,
            verification.credential,
            null,
            tx,
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

        return [newUser, newPasskey];
      });

      // Audit log after successful transaction
      auditLog({
        event: AuditEvent.PASSKEY_REGISTERED,
        userId: user.id,
        metadata: { passkeyId: newPasskey.id, flow: "registration" },
      });

      if (!user.verified) {
        await sendVerificationEmail({ user });
      }

      return {
        user: await serialize(UserSerializer, user, user),
        accessToken: await createAccessToken(user),
      };
    }

    // Handle password registration
    if (!password) {
      throw errors.UNPROCESSABLE_ENTITY({
        message: "Password is required when not using passkey.",
      });
    }

    const [user] = await db.transaction(async (tx) => {
      try {
        return await tx
          .insert(users)
          .values({
            username,
            email,
            passwordHash: generatePasswordHash(password),
            verified: !!config.SKIP_EMAIL_VERIFICATION,
            termsAcceptedAt: sql`NOW()` as unknown as Date,
          })
          .returning();
      } catch (err: any) {
        if (
          err?.code === "23505" &&
          (err?.constraint === "user_username_unq" ||
            err?.constraint === "user_email_unq")
        ) {
          const fieldName =
            err.constraint === "user_username_unq" ? "username" : "email";
          throw errors.CONFLICT({
            message: `An account with this ${fieldName} already exists.`,
          });
        }
        throw err;
      }
    });

    if (!user.verified) {
      await sendVerificationEmail({ user });
    }

    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });
