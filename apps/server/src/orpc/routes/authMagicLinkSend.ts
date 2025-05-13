import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmail } from "@peated/server/lib/email";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "POST", path: "/auth/magic-link/send" })
  .input(
    z.object({
      email: z.string().email(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input: { email } }) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));

    if (!user) {
      console.log("user not found");
      throw new ORPCError("NOT_FOUND", {
        message: "Account not found.",
      });
    }

    if (!user.active) {
      console.log("user not active");
      throw new ORPCError("NOT_FOUND", {
        message: "Account not found.",
      });
    }

    await sendMagicLinkEmail({ user });

    return {};
  });
