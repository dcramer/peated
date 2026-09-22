import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { closeOpenReportsAboutMember } from "@peated/server/lib/reports";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/users/{user}/suspension",
    summary: "Suspend or reinstate a member",
    description:
      "Suspend a member, or lift a suspension. A suspended member can only read their own account, delete it, or cancel a pending deletion; every other request is rejected. Suspending needs a reason. Administrators cannot be suspended, and only an administrator can suspend a moderator. Requires a moderator or administrator.",
    operationId: "updateUserSuspension",
  })
  .input(
    z
      .object({
        user: z.union([z.coerce.number(), z.string()]),
        suspended: z.boolean(),
        reason: z
          .string()
          .trim()
          .max(500)
          .optional()
          .describe("Why the member is suspended. Required when suspending."),
      })
      .strict(),
  )
  .output(UserSchema)
  .handler(async ({ input, context, errors }) => {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({ message: "User not found." });
    }
    if (user.id === context.user.id) {
      throw errors.BAD_REQUEST({ message: "You cannot suspend yourself." });
    }
    if (input.suspended && user.admin) {
      throw errors.FORBIDDEN({
        message: "Administrators cannot be suspended.",
      });
    }
    // Staff rule (moderation): only an administrator can suspend a moderator.
    if (input.suspended && user.mod && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "Only an administrator can suspend a moderator.",
      });
    }
    if (input.suspended && !input.reason) {
      throw errors.BAD_REQUEST({
        message: "A reason is required to suspend a member.",
      });
    }

    if ((user.suspendedAt !== null) === input.suspended) {
      return await serialize(UserSerializer, user, context.user);
    }

    const [updated] = await db
      .update(users)
      .set(
        input.suspended
          ? {
              suspendedAt: new Date(),
              suspendedById: context.user.id,
              suspensionReason: input.reason,
            }
          : { suspendedAt: null, suspendedById: null, suspensionReason: null },
      )
      .where(eq(users.id, user.id))
      .returning();
    if (!updated) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to update suspension.",
      });
    }
    if (input.suspended) {
      await closeOpenReportsAboutMember(db, user.id, {
        closedById: context.user.id,
        note: `Member suspended: ${input.reason}`,
      });
    }

    auditLog({
      event: input.suspended
        ? AuditEvent.ACCOUNT_SUSPENDED
        : AuditEvent.ACCOUNT_REINSTATED,
      userId: context.user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { targetUserId: user.id },
    });

    return await serialize(UserSerializer, updated, context.user);
  });
