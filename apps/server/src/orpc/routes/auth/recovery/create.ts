import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { sendPasswordResetEmail } from "@peated/server/lib/email";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/recovery",
    summary: "Request account recovery",
    description:
      "Send an account recovery email to the specified email address",
    spec: (spec) => ({
      ...spec,
      operationId: "createRecovery",
    }),
  })
  .input(
    z.object({
      email: z.string().email().toLowerCase(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(sql`LOWER(${users.email})`, input.email.toLowerCase()));

      // Only send email if user exists and is active
      // Always return success to prevent user enumeration
      if (user && user.active) {
        await sendPasswordResetEmail({ user });

        auditLog({
          event: AuditEvent.RECOVERY_REQUESTED,
          userId: user.id,
          metadata: { email: input.email },
        });
      }

      return {};
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      logError(error as Error, {
        context: {
          name: "auth/recovery/create",
          email: input.email,
        },
      });

      // Still return success to prevent user enumeration via timing attacks
      return {};
    }
  });
