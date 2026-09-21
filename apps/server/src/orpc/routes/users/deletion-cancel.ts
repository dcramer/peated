import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/users/{user}/deletion",
    summary: "Cancel account deletion",
    description:
      "Cancel the signed-in member's pending account deletion. The account stays as it is. Only the signed-in member can cancel, and the Terms of Service do not need to be accepted. When no deletion is pending, the current account is returned unchanged.",
    operationId: "cancelUserDeletion",
  })
  .input(
    z.object({
      user: z
        .union([z.literal("me"), z.coerce.number(), z.string()])
        .describe("`me`, or your own user ID or username."),
    }),
  )
  .output(UserSchema)
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user || user.id !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "You can only cancel your own account deletion.",
      });
    }

    // Once the deletion has run there is nothing to cancel; the member cannot
    // reach this route then because the account is inactive.
    const [updated] = await db
      .update(users)
      .set({ deletionRequestedAt: null })
      .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
      .returning();
    if (!updated) {
      throw errors.NOT_FOUND({ message: "Account not found." });
    }

    if (user.deletionRequestedAt) {
      auditLog({
        event: AuditEvent.ACCOUNT_DELETION_CANCELED,
        userId: user.id,
      });
    }

    return await serialize(UserSerializer, updated, updated);
  });
