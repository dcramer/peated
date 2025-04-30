import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { verifyPayload } from "@peated/server/lib/auth";
import { EmailVerifySchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../trpc";

export default publicProcedure.input(z.string()).mutation(async function ({
  input,
}) {
  let payload;
  try {
    payload = await verifyPayload(input);
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid verification token.",
    });
  }

  const token = EmailVerifySchema.parse(payload);

  await db
    .update(users)
    .set({
      verified: true,
    })
    .where(
      and(
        eq(users.id, token.id),
        eq(sql`LOWER(${users.email})`, token.email.toLowerCase()),
      ),
    );

  return {};
});
