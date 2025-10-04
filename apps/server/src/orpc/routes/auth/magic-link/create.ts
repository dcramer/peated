import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmail } from "@peated/server/lib/email";
import { assertRateLimit } from "@peated/server/lib/ratelimit";
import { procedure } from "@peated/server/orpc";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
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
      email: z.string().email(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input: { email }, errors, context }) {
    if (!context.clientIP) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to determine client IP address.",
      });
    }
    // Per-IP send limits
    await assertRateLimit(
      {
        key: `rl:magic:create:ip:${context.clientIP}`,
        windowSec: 3600,
        max: 10,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({
          message: "Too many requests. Please try again later.",
        });
      },
    );
    // Per-email send limits (3/10min, 10/hour)
    await assertRateLimit(
      {
        key: `rl:magic:create:email10:${email.toLowerCase()}`,
        windowSec: 600,
        max: 3,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({
          message: "Too many emails sent. Try again later.",
        });
      },
    );
    await assertRateLimit(
      {
        key: `rl:magic:create:email60:${email.toLowerCase()}`,
        windowSec: 3600,
        max: 10,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({
          message: "Too many emails sent. Try again later.",
        });
      },
    );
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));

    if (!user) {
      console.log("user not found");
      throw errors.NOT_FOUND({
        message: "Account not found.",
      });
    }

    if (!user.active) {
      console.log("user not active");
      throw errors.NOT_FOUND({
        message: "Account not found.",
      });
    }

    await sendMagicLinkEmail({ user });

    return {};
  });
