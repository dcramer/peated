import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import {
  createAccessToken,
  generatePasswordHash,
  verifyPayload,
} from "@peated/server/lib/auth";
import { PasswordResetSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

const TOKEN_CUTOFF = 600; // 10 minutes

export default publicProcedure
  .input(
    z.object({
      token: z.string(),
      password: z.string().trim().min(8, "At least 8 characters."),
    }),
  )
  .mutation(async function ({ input }) {
    let payload;
    try {
      payload = await verifyPayload(input.token);
    } catch (err) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid verification token.",
      });
    }

    const token = PasswordResetSchema.parse(payload);
    if (
      new Date(token.createdAt).getTime() <
      new Date().getTime() - TOKEN_CUTOFF * 1000
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid verification token.",
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
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid verification token.",
      });
    }

    if (
      token.digest !==
      createHash("md5")
        .update(user.passwordHash || "")
        .digest("hex")
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid verification token.",
      });
    }

    const [newUser] = await db
      .update(users)
      .set({
        passwordHash: generatePasswordHash(input.password),
        verified: true, // they had to verify the token via email to get here
      })
      .where(eq(users.id, user.id))
      .returning();

    return {
      user: await serialize(UserSerializer, newUser, newUser),
      accessToken: await createAccessToken(newUser),
    };
  });
