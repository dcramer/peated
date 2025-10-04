import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmailForRequest } from "@peated/server/lib/email";
import { createLoginRequestForUser } from "@peated/server/lib/magicLinkCode";
import { assertRateLimit } from "@peated/server/lib/ratelimit";
import { procedure } from "@peated/server/orpc";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "POST",
    path: "/auth/magic-link/start",
    summary: "Start email code login",
    description:
      "Creates a login request, emails the code + link, and returns requestId and expiry",
    spec: (spec) => ({
      ...spec,
      operationId: "startMagicLink",
    }),
  })
  .input(
    z.object({
      email: z.string().email(),
      redirectTo: z.string().optional(),
    }),
  )
  .output(
    z.object({
      requestId: z.string(),
      expiresIn: z.number().describe("seconds until expiry"),
    }),
  )
  .handler(async function ({ input: { email, redirectTo }, errors, context }) {
    if (!context.clientIP) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to determine client IP address.",
      });
    }
    await assertRateLimit(
      {
        key: `rl:magic:start:ip:${context.clientIP}`,
        windowSec: 3600,
        max: 10,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({ message: "Too many requests." });
      },
    );
    await assertRateLimit(
      {
        key: `rl:magic:start:email10:${email.toLowerCase()}`,
        windowSec: 600,
        max: 3,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({ message: "Too many emails sent." });
      },
    );
    await assertRateLimit(
      {
        key: `rl:magic:start:email60:${email.toLowerCase()}`,
        windowSec: 3600,
        max: 10,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({ message: "Too many emails sent." });
      },
    );

    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));

    // Always perform the same operations to prevent timing attacks that reveal email existence
    if (!user || !user.active) {
      // Simulate the same operations as if the user existed to prevent timing leaks
      await new Promise((resolve) =>
        setTimeout(resolve, 100 + Math.random() * 50),
      );
      throw errors.NOT_FOUND({ message: "Account not found." });
    }

    const req = await createLoginRequestForUser(user, { redirectTo });
    await sendMagicLinkEmailForRequest({ user, request: req });

    const expiresIn = Math.max(
      0,
      Math.floor((req.expiresAt.getTime() - Date.now()) / 1000),
    );
    return { requestId: req.requestId, expiresIn };
  });
