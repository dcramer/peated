import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken } from "@peated/server/lib/auth";
import { verifyLoginCode } from "@peated/server/lib/magicLinkCode";
import { assertRateLimit } from "@peated/server/lib/ratelimit";
import { procedure } from "@peated/server/orpc";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "POST",
    path: "/auth/magic-link/verify",
    summary: "Verify email code",
    description: "Verify a one-time email login code and return access token",
    spec: (spec) => ({
      ...spec,
      operationId: "verifyMagicCode",
    }),
  })
  .input(
    z.object({
      requestId: z.string().describe("Login request id from email link"),
      code: z.string().describe("6-digit login code"),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input: { requestId, code }, errors, context }) {
    if (!context.clientIP) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to determine client IP address.",
      });
    }
    await assertRateLimit(
      {
        key: `rl:magic:verify:ip:${context.clientIP}`,
        windowSec: 3600,
        max: 60,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({
          message: "Too many attempts. Try later.",
        });
      },
    );
    const result = await verifyLoginCode(requestId, code);
    if (!result.ok) {
      throw errors.BAD_REQUEST({ message: "Invalid or expired code." });
    }

    // User validation already done in verifyLoginCode, just verify email on successful login
    const [updatedUser] = await db
      .update(users)
      .set({ verified: true })
      .where(eq(users.id, result.userId))
      .returning();

    return {
      user: await serialize(UserSerializer, updatedUser, updatedUser),
      accessToken: await createAccessToken(updatedUser),
    };
  });
