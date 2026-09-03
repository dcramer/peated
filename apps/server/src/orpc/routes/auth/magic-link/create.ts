import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmail } from "@peated/server/lib/email";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export type MagicLinkSender = typeof sendMagicLinkEmail;

/** Attempts email delivery and returns success even if no account exists or delivery fails. */
export function createMagicLinkProcedure(
  sendEmail: MagicLinkSender = sendMagicLinkEmail,
) {
  return procedure
    .use(authRateLimit)
    .route({
      method: "POST",
      path: "/auth/magic-link",
      summary: "Create magic link",
      description:
        "Send a magic link authentication email to the specified email address",
      spec: (spec) => ({
        ...spec,
        operationId: "createMagicLink",
      }),
    })
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
      }),
    )
    .output(z.object({}))
    .handler(async function ({ input: { email } }) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(sql`LOWER(${users.email})`, email));

      // Account access rule: the response must not reveal whether an account exists.
      if (!user?.active) return {};

      try {
        await sendEmail({ user });
      } catch (error) {
        logError(error, {
          extra: {
            name: "auth/magic-link/create",
            userId: user.id,
          },
        });
      }

      return {};
    });
}

export default createMagicLinkProcedure();
