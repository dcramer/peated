import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { createAccessToken, verifyPayload } from "@peated/server/lib/auth";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { AuthSchema } from "@peated/server/schemas";
import { MagicLinkSchema } from "@peated/server/schemas/magicLink";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const TOKEN_CUTOFF = 600; // 10 minutes

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/magic-link/confirm",
    summary: "Confirm magic link",
    description:
      "Confirm magic link authentication and return access token. Automatically verifies the user account",
    spec: (spec) => ({
      ...spec,
      operationId: "confirmMagicLink",
    }),
  })
  .input(
    z.object({
      token: z.string(),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input, context, errors }) {
    let payload;
    try {
      payload = await verifyPayload(input.token);
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
        cause: err,
      });
    }

    let parsedPayload;
    try {
      parsedPayload = MagicLinkSchema.parse(payload);
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
        cause: err,
      });
    }

    if (
      new Date(parsedPayload.createdAt).getTime() <
      new Date().getTime() - TOKEN_CUTOFF * 1000
    ) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, parsedPayload.id),
          eq(sql`LOWER(${users.email})`, parsedPayload.email.toLowerCase()),
        ),
      );
    if (!user) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
      });
    }

    if (!user.active) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
      });
    }

    // Update user as verified
    const [updatedUser] = await db
      .update(users)
      .set({
        verified: true,
      })
      .where(eq(users.id, user.id))
      .returning();

    auditLog({
      event: AuditEvent.LOGIN_SUCCESS,
      userId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { method: "magic_link" },
    });

    return {
      user: await serialize(UserSerializer, updatedUser, updatedUser),
      accessToken: await createAccessToken(updatedUser),
    };
  });
