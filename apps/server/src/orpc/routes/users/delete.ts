import { db } from "@peated/server/db";
import { identities, users } from "@peated/server/db/schema";
import { getDeletionScheduledAt } from "@peated/server/lib/accountDeletion";
import { getUserFromId } from "@peated/server/lib/api";
import {
  AppleRevocationError,
  getAppleRevocationConfig,
  revokeAppleAuthorization,
} from "@peated/server/lib/apple";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { sendAccountDeletionEmail } from "@peated/server/lib/email";
import { logError, logWarn } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export type DeleteUserServices = {
  revokeAppleAuthorization: typeof revokeAppleAuthorization;
  /** Whether the server can talk to Apple. Deletion never waits on setup. */
  isAppleRevocationConfigured: () => boolean;
  sendAccountDeletionEmail: typeof sendAccountDeletionEmail;
};

const defaultServices: DeleteUserServices = {
  revokeAppleAuthorization,
  isAppleRevocationConfigured: () => getAppleRevocationConfig() !== null,
  sendAccountDeletionEmail,
};

export function createDeleteUserProcedure(
  services: DeleteUserServices = defaultServices,
) {
  // Account access rule: deletion needs authentication only. A member who has
  // not accepted the current terms can still delete their account.
  return procedure
    .use(requireAuth)
    .route({
      method: "DELETE",
      path: "/users/{user}",
      summary: "Request account deletion",
      description:
        "Schedule the signed-in member's account for deletion 24 hours from now and email a confirmation. The account keeps working until then, and `DELETE /users/{user}/deletion` cancels the request. When the deletion runs, the profile, sign-in methods, comments, collections, and uploaded images are removed, tastings and reviews are hidden, and catalog contributions stay with the member's name removed. Only the signed-in member can request this, and the Terms of Service do not need to be accepted. When the account used Sign in with Apple, send a fresh `appleAuthorizationCode` so the Apple grant is revoked now, as Apple requires. Repeating the request returns the existing schedule.",
      operationId: "deleteUser",
    })
    .input(
      z.object({
        user: z
          .union([z.literal("me"), z.coerce.number(), z.string()])
          .describe("`me`, or your own user ID or username."),
        appleAuthorizationCode: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Authorization code from a new Sign in with Apple prompt. It is single-use and expires after five minutes. Ignored when the account has no Apple identity.",
          ),
      }),
    )
    .output(UserSchema)
    .handler(async function ({ input, context, errors }) {
      const user = await getUserFromId(db, input.user, context.user);
      if (!user || user.id !== context.user.id) {
        throw errors.FORBIDDEN({
          message: "You can only delete your own account.",
        });
      }

      const [appleIdentity] = await db
        .select({ id: identities.id })
        .from(identities)
        .where(
          and(eq(identities.userId, user.id), eq(identities.provider, "apple")),
        )
        .limit(1);

      // Revoke now: the Apple code lives five minutes, so it cannot wait for
      // the grace period. If Apple fails, nothing is scheduled and the client
      // retries with a new code. A member who cancels later simply signs in
      // with Apple again.
      // Deletion itself never depends on Apple: the code is optional, and a
      // server without Apple credentials schedules the deletion anyway.
      let revokeApple = Boolean(appleIdentity && input.appleAuthorizationCode);
      if (revokeApple && !services.isAppleRevocationConfigured()) {
        logWarn("Apple grant not revoked: server credentials are missing", {
          extra: { userId: user.id },
        });
        revokeApple = false;
      }
      if (revokeApple && input.appleAuthorizationCode) {
        try {
          await services.revokeAppleAuthorization(input.appleAuthorizationCode);
        } catch (error) {
          if (error instanceof AppleRevocationError) {
            if (error.retryable) {
              throw errors.INTERNAL_SERVER_ERROR({
                message: "Apple could not be reached. Try again later.",
                cause: error,
              });
            }
            throw errors.BAD_REQUEST({
              message:
                "Apple did not accept the authorization code. Sign in with Apple again and retry.",
              cause: error,
            });
          }
          throw error;
        }
      }

      // Repeating the request keeps the existing schedule.
      if (user.deletionRequestedAt) {
        return await serialize(UserSerializer, user, user);
      }

      const [scheduled] = await db
        .update(users)
        .set({ deletionRequestedAt: sql<Date>`NOW()` })
        .where(eq(users.id, user.id))
        .returning();
      if (!scheduled) {
        throw errors.NOT_FOUND({ message: "Account not found." });
      }

      auditLog({
        event: AuditEvent.ACCOUNT_DELETION_REQUESTED,
        userId: user.id,
        metadata: { appleRevoked: revokeApple },
      });

      // The schedule is saved; a failed email must not undo it.
      const deletionScheduledAt = getDeletionScheduledAt(scheduled);
      if (deletionScheduledAt) {
        try {
          await services.sendAccountDeletionEmail({
            user: scheduled,
            deletionScheduledAt,
          });
        } catch (error) {
          logError(error, {
            extra: { userId: user.id, operation: "accountDeletion.email" },
          });
        }
      }

      return await serialize(UserSerializer, scheduled, scheduled);
    });
}

export default createDeleteUserProcedure();
