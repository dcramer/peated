import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/auth/tos/accept",
    summary: "Accept Terms of Service",
    description:
      "Marks the current user as having accepted the Terms of Service.",
    spec: (spec) => ({
      ...spec,
      operationId: "acceptTos",
    }),
  })
  .input(z.void())
  .output(UserSchema)
  .handler(async function ({ context: { user } }) {
    // If already accepted, fetch current user data
    if (user.termsAcceptedAt) {
      const [current] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      return await serialize(UserSerializer, current ?? user, user);
    }

    const [updated] = await db
      .update(users)
      .set({ termsAcceptedAt: sql`NOW()` as unknown as Date })
      .where(and(eq(users.id, user.id), sql`${users.termsAcceptedAt} IS NULL`))
      .returning();

    // If update returned nothing, someone else updated it concurrently
    if (!updated) {
      const [current] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      return await serialize(UserSerializer, current ?? user, user);
    }

    return await serialize(UserSerializer, updated, user);
  });
