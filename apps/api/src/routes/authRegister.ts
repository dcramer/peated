import { OpenAPIHono } from "@hono/zod-openapi";
import config from "@peated/api/config";
import { db } from "@peated/api/db";
import { users } from "@peated/api/db/schema";
import { createAccessToken, generatePasswordHash } from "@peated/api/lib/auth";
import { sendVerificationEmail } from "@peated/api/lib/email";
import { AuthSchema } from "@peated/api/schemas";
import { serialize } from "@peated/api/serializers";
import { UserSerializer } from "@peated/api/serializers/user";
import { eq, sql } from "drizzle-orm";
import { ConflictError, conflictSchema } from "http-errors-enhanced";
import { z } from "zod";

const RegisterSchema = z.object({
  username: z.string().toLowerCase(),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default new OpenAPIHono().openapi(
  {
    method: "post",
    path: "/",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RegisterSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AuthSchema,
          },
        },
        description: "User registration successful",
      },
      409: conflictSchema,
    },
  },
  async function (c) {
    const { username, email, password } = c.req.valid("json");

    const [user] = await db.transaction(async (tx) => {
      try {
        return await tx
          .insert(users)
          .values({
            username,
            email,
            passwordHash: generatePasswordHash(password),
            verified: !!config.SKIP_EMAIL_VERIFICATION,
          })
          .returning();
      } catch (err: any) {
        if (
          err?.code === "23505" &&
          (err?.constraint === "user_username_unq" ||
            err?.constraint === "user_email_unq")
        ) {
          const [existingUser] = await db
            .select()
            .from(users)
            .where(
              err.constraint === "user_username_unq"
                ? eq(sql`LOWER(${users.username})`, username.toLowerCase())
                : eq(sql`LOWER(${users.email})`, email.toLowerCase()),
            );
          throw new ConflictError(existingUser, err);
        }
        throw err;
      }
    });

    if (!user.verified) {
      await sendVerificationEmail({ user });
    }

    return c.json({
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    });
  },
);
