import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, sql } from "drizzle-orm";

export default procedure
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
  .input(undefined)
  .output(UserSchema)
  .handler(async function ({ ctx, errors }) {
    const user = ctx.user;
    if (!user) throw errors.UNAUTHORIZED();

    const [updated] = await db
      .update(users)
      .set({ tosAcceptedAt: sql`NOW()` as unknown as Date })
      .where(and(eq(users.id, user.id), sql`${users.tosAcceptedAt} IS NULL`))
      .returning();

    return await serialize(UserSerializer, updated, updated);
  });
