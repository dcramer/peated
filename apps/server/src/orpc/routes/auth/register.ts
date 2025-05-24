import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import {
  createAccessToken,
  generatePasswordHash,
} from "@peated/server/lib/auth";
import { sendVerificationEmail } from "@peated/server/lib/email";
import { procedure } from "@peated/server/orpc";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "POST", path: "/auth/register" })
  .input(
    z.object({
      username: z.string().toLowerCase(),
      email: z.string(),
      password: z.string(),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input: { username, email, password }, errors }) {
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
          throw errors.CONFLICT({
            message: `Conflicting object already exists (ID=${existingUser.id}).`,
          });
        }
        throw err;
      }
    });

    if (!user.verified) {
      await sendVerificationEmail({ user });
    }

    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });
