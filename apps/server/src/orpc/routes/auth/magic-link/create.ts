import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmail } from "@peated/server/lib/email";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
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
  .handler(async function ({ input: { email }, errors }) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, email));

    if (!user) {
      throw errors.NOT_FOUND({
        message: "Account not found.",
      });
    }

    if (!user.active) {
      throw errors.NOT_FOUND({
        message: "Account not found.",
      });
    }

    try {
      await sendMagicLinkEmail({ user });
    } catch (error) {
      logError(error, {
        context: {
          name: "auth/magic-link/create",
          userId: user.id,
        },
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to send magic link email.",
      });
    }

    return {};
  });
