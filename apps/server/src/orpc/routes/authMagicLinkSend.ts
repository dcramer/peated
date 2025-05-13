import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { sendMagicLinkEmail } from "@peated/server/lib/email";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      email: z.string().email(),
    }),
  )
  .mutation(async function ({ input: { email } }) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));

    if (!user) {
      console.log("user not found");
      throw new TRPCError({
        message: "Account not found.",
        code: "NOT_FOUND",
      });
    }

    if (!user.active) {
      console.log("user not active");
      throw new TRPCError({
        message: "Account not found.",
        code: "NOT_FOUND",
      });
    }

    await sendMagicLinkEmail({ user });

    return {};
  });
