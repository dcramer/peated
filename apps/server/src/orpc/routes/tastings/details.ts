import { db } from "@peated/server/db";
import { follows, tastings, users } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import tastingDetailsContract from "@peated/server/orpc/contracts/tastings/details";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { and, eq, or, sql } from "drizzle-orm";

export default implement(tastingDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  // Tasting privacy follows the list route: only the author and accepted followers can read private activity.
  const visible = or(
    eq(users.private, false),
    ...(context.user
      ? [
          eq(tastings.createdById, context.user.id),
          sql`${tastings.createdById} IN (
            SELECT ${follows.toUserId} FROM ${follows}
            WHERE ${follows.fromUserId} = ${context.user.id}
              AND ${follows.status} = 'following'
          )`,
        ]
      : []),
  );
  const [result] = await db
    .select({ tasting: tastings })
    .from(tastings)
    .innerJoin(users, eq(users.id, tastings.createdById))
    .where(and(eq(tastings.id, input.tasting), visible));

  if (!result) {
    throw errors.NOT_FOUND({
      message: "Tasting not found.",
    });
  }

  return await serialize(TastingSerializer, result.tasting, context.user);
});
