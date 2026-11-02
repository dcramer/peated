import { inArray } from "drizzle-orm";
import type { z } from "zod";
import { serializer } from ".";
import { db } from "../db";
import type { BotSite } from "../db/schema";
import { users } from "../db/schema";
import type { BotSiteSchema } from "../schemas";

type BotSiteAttrs = {
  exceptionBy: { id: number; username: string } | null;
};

export const BotSiteSerializer = serializer({
  name: "botSite",
  attrs: async (itemList: BotSite[]): Promise<Record<number, BotSiteAttrs>> => {
    const userIds = [
      ...new Set(
        itemList.flatMap((item) =>
          item.robotsExceptionById === null ? [] : [item.robotsExceptionById],
        ),
      ),
    ];
    const userList = userIds.length
      ? await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const usersById = new Map(userList.map((user) => [user.id, user]));

    // Bot sites have no `id`, so attrs are keyed by position.
    return Object.fromEntries(
      itemList.map((item, index) => [
        index,
        {
          exceptionBy:
            item.robotsExceptionById === null
              ? null
              : (usersById.get(item.robotsExceptionById) ?? null),
        },
      ]),
    );
  },
  item: (
    item: BotSite,
    attrs: BotSiteAttrs,
  ): z.infer<typeof BotSiteSchema> => ({
    origin: item.origin,
    blockedAt: item.blockedAt?.toISOString() ?? null,
    robotsException:
      item.robotsExceptionReason !== null && item.robotsExceptionAt !== null
        ? {
            reason: item.robotsExceptionReason,
            createdAt: item.robotsExceptionAt.toISOString(),
            createdBy: attrs.exceptionBy,
          }
        : null,
  }),
});
