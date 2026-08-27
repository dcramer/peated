import { db } from "@peated/server/db";
import type { BadgeAward, User } from "@peated/server/db/schema";
import { badgeAwards, badges, users } from "@peated/server/db/schema";
import { notEmpty } from "@peated/server/lib/filter";
import { implement } from "@peated/server/orpc";
import badgeUserListContract from "@peated/server/orpc/contracts/badges/user-list";
import { requireAuth } from "@peated/server/orpc/middleware";
import type { UserSchema } from "@peated/server/schemas";
import { serialize, serializer } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, desc, eq, ne } from "drizzle-orm";
import type { z } from "zod";

interface BadgeAwardUserAttrs {
  user: z.infer<typeof UserSchema>;
}

export const Serializer = serializer({
  name: "badgeAwardUser",
  attrs: async (
    itemList: (BadgeAward & { user: User })[],
    currentUser?: User,
  ) => {
    const userList = itemList.map((i) => i.user).filter(notEmpty);

    const usersById = Object.fromEntries(
      (await serialize(UserSerializer, userList, currentUser)).map(
        (data, index) => [userList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            user: usersById[item.userId],
          },
        ];
      }),
    );
  },
  item: (item: BadgeAward & { user: User }, attrs: BadgeAwardUserAttrs) => {
    return {
      id: item.id,
      xp: item.xp,
      level: item.level,
      user: attrs.user,
      createdAt: item.createdAt.toISOString(),
    };
  },
});

export default implement(badgeUserListContract)
  .use(requireAuth)
  .handler(async function ({
    input: { cursor, limit, ...input },
    context,
    errors,
  }) {
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, input.badge));
    if (!badge) {
      throw errors.NOT_FOUND({
        message: "Badge not found.",
      });
    }

    const offset = (cursor - 1) * limit;

    const results = await db
      .select({
        badgeAward: badgeAwards,
        user: users,
      })
      .from(users)
      .innerJoin(badgeAwards, eq(badgeAwards.userId, users.id))
      .where(
        and(
          eq(users.private, false),
          eq(badgeAwards.badgeId, badge.id),
          ne(badgeAwards.level, 0),
        ),
      )
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(badgeAwards.xp));

    return {
      results: await serialize(
        Serializer,
        results
          .map((i) => ({
            ...i.badgeAward,
            user: i.user,
          }))
          .slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
