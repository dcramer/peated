import { db } from "@peated/server/db";
import { passkeys, users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/auth/passkey/:passkeyId",
    summary: "Delete a passkey",
    description: "Remove a passkey from the user's account",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyDelete",
    }),
  })
  .input(
    z.object({
      passkeyId: z.number(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    // Use a transaction to prevent race conditions
    await db.transaction(async (tx) => {
      // Lock user's passkeys using FOR UPDATE to prevent concurrent deletes
      // This prevents the race condition where two passkeys could be deleted simultaneously
      const userPasskeys = await tx
        .select()
        .from(passkeys)
        .where(eq(passkeys.userId, user.id))
        .for("update");

      // Check if passkey exists and belongs to user
      const passkey = userPasskeys.find((p) => p.id === input.passkeyId);
      if (!passkey) {
        throw errors.NOT_FOUND({
          message: "Passkey not found",
        });
      }

      // Prevent deleting the last passkey if user has no password
      // (we don't want to lock them out)
      const [userWithPassword] = await tx
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.id));

      if (userPasskeys.length === 1 && !userWithPassword?.passwordHash) {
        throw errors.FORBIDDEN({
          message:
            "Cannot delete your last passkey. Please set a password first to ensure you can still access your account.",
        });
      }

      // Delete the passkey with userId re-check for extra safety
      await tx
        .delete(passkeys)
        .where(
          and(eq(passkeys.id, input.passkeyId), eq(passkeys.userId, user.id)),
        );
    });

    auditLog({
      event: AuditEvent.PASSKEY_DELETED,
      userId: user.id,
      metadata: { passkeyId: input.passkeyId },
    });

    return { ok: true };
  });
