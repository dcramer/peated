import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendPasswordResetEmail } from "@peated/server/lib/email";
import { procedure } from "@peated/server/orpc";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "POST",
    path: "/auth/password-reset",
    summary: "Request password reset",
    description: "Send a password reset email to the specified email address",
  })
  .input(
    z.object({
      email: z.string().email(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, input.email.toLowerCase()));
    if (!user) {
      console.log("user not found");
      throw errors.NOT_FOUND({
        message: "Account not found.",
      });
    }

    if (!user.active) {
      throw errors.NOT_FOUND({
        message: "Account not found.",
      });
    }

    await sendPasswordResetEmail({ user });

    return {};
  });
