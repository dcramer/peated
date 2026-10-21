import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { findRecoveryTokenUser } from "@peated/server/lib/accountRecovery";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import {
  createAccessToken,
  generatePasswordHash,
} from "@peated/server/lib/auth";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/recovery/confirm",
    summary: "Confirm account recovery",
    description:
      "Confirm account recovery using token from email and set new password. Automatically verifies the user account",
    spec: (spec) => ({
      ...spec,
      operationId: "confirmRecovery",
    }),
  })
  .input(
    z.object({
      token: z.string(),
      password: z.string().trim().min(8, "At least 8 characters."),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input, context }) {
    const user = await findRecoveryTokenUser(input.token, {
      flow: "password_reset",
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const [newUser] = await db
      .update(users)
      .set({
        passwordHash: generatePasswordHash(input.password),
        verified: true, // they had to verify the token via email to get here
      })
      .where(eq(users.id, user.id))
      .returning();

    auditLog({
      event: AuditEvent.RECOVERY_SUCCESS,
      userId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { flow: "password_reset" },
    });

    return {
      user: await serialize(UserSerializer, newUser, newUser),
      accessToken: await createAccessToken(newUser),
    };
  });
