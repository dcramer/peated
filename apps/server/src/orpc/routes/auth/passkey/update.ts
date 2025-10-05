import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "PATCH",
    path: "/auth/passkey/:passkeyId",
    summary: "Update passkey nickname",
    description: "Update the nickname for a passkey",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyUpdate",
    }),
  })
  .input(
    z.object({
      passkeyId: z.number(),
      nickname: z
        .string()
        .trim()
        .min(1, "Nickname must not be empty")
        .max(100, "Nickname must be 100 characters or less")
        .regex(
          /^[^<>]*$/,
          "Nickname cannot contain HTML tags or script content",
        )
        .nullish(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    // Check if passkey exists and belongs to user
    const [passkey] = await db
      .select()
      .from(passkeys)
      .where(
        and(eq(passkeys.id, input.passkeyId), eq(passkeys.userId, user.id)),
      );

    if (!passkey) {
      throw errors.NOT_FOUND({
        message: "Passkey not found",
      });
    }

    await db
      .update(passkeys)
      .set({
        nickname: input.nickname ?? null,
      })
      .where(
        and(eq(passkeys.id, input.passkeyId), eq(passkeys.userId, user.id)),
      );

    auditLog({
      event: AuditEvent.PASSKEY_UPDATED,
      userId: user.id,
      metadata: {
        passkeyId: input.passkeyId,
        nickname: input.nickname,
      },
    });

    return { ok: true };
  });
