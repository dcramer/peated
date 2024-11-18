import { db } from "@peated/server/db";
import type { BadgeAward, User } from "@peated/server/db/schema";
import { badgeAwards, badges, users } from "@peated/server/db/schema";
import { notEmpty } from "@peated/server/lib/filter";
import { serialize, serializer } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";

export const Serializer = serializer({
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
  item: (
    item: BadgeAward & { user: User },
    attrs: Record<string, any>,
    currentUser?: User,
  ) => {
    return {
      id: item.id,
      xp: item.xp,
      level: item.level,
      user: attrs.user,
      createdAt: item.createdAt.toISOString(),
    };
  },
});

const InputSchema = z.object({
  badge: z.number(),
  cursor: z.number().gte(1).default(1),
  limit: z.number().gte(1).lte(100).default(25),
});

export async function badgeUserList({
  input: { cursor, limit, ...input },
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const [badge] = await db
    .select()
    .from(badges)
    .where(eq(badges.id, input.badge));
  if (!badge) {
    throw new TRPCError({
      code: "NOT_FOUND",
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
      ctx.user,
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}

export default authedProcedure.input(InputSchema).query(badgeUserList);
