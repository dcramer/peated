import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { verifyPayload } from "@peated/server/lib/auth";
import { logError } from "@peated/server/lib/log";
import { generatePasskeyChallenge } from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { PasswordResetSchema } from "@peated/server/schemas";
import { createHash, timingSafeEqual } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const TOKEN_CUTOFF = 600; // 10 minutes

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/recovery/challenge",
    summary: "Generate challenge for account recovery",
    description:
      "Generate WebAuthn challenge for adding a passkey during account recovery",
    spec: (spec) => ({
      ...spec,
      operationId: "recoveryChallenge",
    }),
  })
  .input(
    z.object({
      token: z.string().describe("Recovery token from email"),
    }),
  )
  .output(
    z.object({
      options: z.any(),
      signedChallenge: z.string(),
    }),
  )
  .handler(async function ({ input, errors }) {
    try {
      // Verify the recovery token
      let payload;
      try {
        payload = await verifyPayload(input.token);
      } catch (err) {
        throw errors.BAD_REQUEST({
          message: "Invalid verification token.",
        });
      }

      const token = PasswordResetSchema.parse(payload);
      if (
        new Date(token.createdAt).getTime() <
        new Date().getTime() - TOKEN_CUTOFF * 1000
      ) {
        throw errors.BAD_REQUEST({
          message: "Token has expired.",
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
      if (!user) {
        throw errors.BAD_REQUEST({
          message: "Invalid verification token.",
        });
      }

      // Verify password hash digest using SHA-256 and constant-time comparison
      const expectedDigest = createHash("sha256")
        .update(user.passwordHash || "")
        .digest();
      const providedDigest = Buffer.from(token.digest, "hex");

      if (
        expectedDigest.length !== providedDigest.length ||
        !timingSafeEqual(expectedDigest, providedDigest)
      ) {
        throw errors.BAD_REQUEST({
          message: "Invalid verification token.",
        });
      }

      // Generate WebAuthn registration options
      return await generatePasskeyChallenge({
        username: user.username,
        userID: user.id,
      });
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      logError(error as Error, {
        context: {
          name: "auth/recovery/challenge",
        },
      });

      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to generate recovery challenge.",
      });
    }
  });
