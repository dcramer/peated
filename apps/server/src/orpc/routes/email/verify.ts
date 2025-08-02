import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { verifyPayload } from "@peated/server/lib/auth";
import { procedure } from "@peated/server/orpc";
import { EmailVerifySchema } from "@peated/server/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "POST",
    path: "/email/verify",
    summary: "Verify email",
    spec: {},
    description:
      "Verify user email address using verification token from email",
  })
  .input(z.object({ token: z.string() }))
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    let payload;
    try {
      payload = await verifyPayload(input.token);
    } catch (err) {
      throw errors.BAD_REQUEST({
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
