import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import {
  createAccessToken,
  TOKEN_LIFETIME_SECONDS,
  verifyToken,
} from "@peated/server/lib/auth";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { AuthSchema } from "@peated/server/schemas";
import { MagicLinkSchema } from "@peated/server/schemas/magicLink";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

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
    let token;
    try {
      token = MagicLinkSchema.parse(
        await verifyToken(input.token, "magic-link"),
      );
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
        cause: err,
      });
    }

    if (
      new Date(token.createdAt).getTime() <
      Date.now() - TOKEN_LIFETIME_SECONDS["magic-link"] * 1000
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
          eq(users.id, token.id),
          eq(sql`LOWER(${users.email})`, token.email.toLowerCase()),
        ),
      );
    if (!user?.active) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
      });
    }

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
