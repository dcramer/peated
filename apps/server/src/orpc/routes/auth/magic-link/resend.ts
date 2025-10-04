import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmailForRequest } from "@peated/server/lib/email";
import { rotateLoginRequest } from "@peated/server/lib/magicLinkCode";
import { assertRateLimit } from "@peated/server/lib/ratelimit";
import { procedure } from "@peated/server/orpc";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "POST",
    path: "/auth/magic-link/resend",
    summary: "Resend email login code",
    description: "Resends a fresh code for an existing login request",
    spec: (spec) => ({ ...spec, operationId: "resendMagicLink" }),
  })
  .input(z.object({ requestId: z.string() }))
  .output(z.object({ ok: z.literal(true), expiresIn: z.number() }))
  .handler(async function ({ input: { requestId }, errors, context }) {
    if (!context.clientIP) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to determine client IP address.",
      });
    }
    await assertRateLimit(
      {
        key: `rl:magic:resend:ip:${context.clientIP}`,
        windowSec: 3600,
        max: 30,
      },
      () => {
        throw errors.TOO_MANY_REQUESTS({ message: "Too many requests." });
      },
    );
    // Cooldown per request
    await assertRateLimit(
      { key: `rl:magic:resend:req:${requestId}:30s`, windowSec: 30, max: 1 },
      () => {
        throw errors.TOO_MANY_REQUESTS({
          message: "Please wait before resending.",
        });
      },
    );
    await assertRateLimit(
      { key: `rl:magic:resend:req:${requestId}:1h`, windowSec: 3600, max: 5 },
      () => {
        throw errors.TOO_MANY_REQUESTS({ message: "Too many resends." });
      },
    );

    const rotated = await rotateLoginRequest(requestId);
    if (!rotated.ok) {
      throw errors.BAD_REQUEST({ message: "Request expired. Start again." });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, rotated.userId));
    if (!user || !user.active) {
      throw errors.BAD_REQUEST({ message: "Request invalid." });
    }

    await sendMagicLinkEmailForRequest({ user, request: rotated });
    const expiresIn = Math.max(
      0,
      Math.floor((rotated.expiresAt.getTime() - Date.now()) / 1000),
    );
    return { ok: true, expiresIn } as const;
  });
