import { db } from "@peated/server/db";
import { badgeAwards } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import userBadgeListContract from "@peated/server/orpc/contracts/users/badge-list";
import { serialize } from "@peated/server/serializers";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export default implement(userBadgeListContract).handler(async function ({
  input: { cursor, limit, ...input },
  context,
  errors,
}) {
  const user = await getUserFromId(db, input.user, context.user);
  if (!user) {
    throw errors.NOT_FOUND({
      message: "User not found.",
    });
  }

  if (!(await profileVisible(db, user, context.user))) {
    throw errors.BAD_REQUEST({
      message: "User's profile is not public.",
    });
  }

  const offset = (cursor - 1) * limit;

  const results = await db
    .select()
    .from(badgeAwards)
    .where(and(eq(badgeAwards.userId, user.id), gte(badgeAwards.xp, 0)))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(
      sql`CASE WHEN ${badgeAwards.level} = 0 THEN 1 ELSE 0 END`,
      desc(badgeAwards.createdAt),
    );

  return {
    results: await serialize(
      BadgeAwardSerializer,
      results.slice(0, limit),
      context.user,
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
