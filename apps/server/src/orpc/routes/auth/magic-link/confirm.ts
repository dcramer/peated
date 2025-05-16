import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken, verifyPayload } from "@peated/server/lib/auth";
import { procedure } from "@peated/server/orpc";
import { AuthSchema } from "@peated/server/schemas";
import { MagicLinkSchema } from "@peated/server/schemas/magicLink";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const TOKEN_CUTOFF = 600; // 10 minutes

export default procedure
  .route({ method: "POST", path: "/auth/magic-link/confirm" })
  .input(
    z.object({
      token: z.string(),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input, errors }) {
    let payload;
    try {
      payload = await verifyPayload(input.token);
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
        cause: err,
      });
    }

    let parsedPayload;
    try {
      parsedPayload = MagicLinkSchema.parse(payload);
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "Invalid magic link token.",
        cause: err,
      });
    }

    if (
      new Date(parsedPayload.createdAt).getTime() <
      new Date().getTime() - TOKEN_CUTOFF * 1000
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid magic link token.",
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, parsedPayload.id),
          eq(sql`LOWER(${users.email})`, parsedPayload.email.toLowerCase()),
        ),
      );
    if (!user) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid magic link token.",
      });
    }

    if (!user.active) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid magic link token.",
      });
    }

    // Update user as verified
    const [updatedUser] = await db
      .update(users)
      .set({
        verified: true,
      })
      .where(eq(users.id, user.id))
      .returning();

    return {
      user: await serialize(UserSerializer, updatedUser, updatedUser),
      accessToken: await createAccessToken(updatedUser),
    };
  });
