import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { badges, type BadgeAward, type User } from "../db/schema";
import { notEmpty } from "../lib/filter";
import type { BadgeAwardSchema } from "../schemas";
import type { Badge } from "../types";
import { BadgeSerializer } from "./badge";

export const BadgeAwardSerializer = serializer({
  attrs: async (
    itemList: (BadgeAward & {
      badge?: Badge;
    })[],
    currentUser?: User,
  ) => {
    const hasBadge = itemList.length && "badge" in itemList[0];

    const badgeIds = itemList.map((i) => i.badgeId).filter(notEmpty);
    const badgeList = hasBadge
      ? itemList.map((i) => i.badge).filter(notEmpty)
      : badgeIds.length
        ? await db.select().from(badges).where(inArray(badges.id, badgeIds))
        : [];

    const badgesById = Object.fromEntries(
      (await serialize(BadgeSerializer, badgeList, currentUser)).map(
        (data, index) => [badgeList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            badge: badgesById[item.badgeId],
          },
        ];
      }),
    );
  },
  item: (
    item: BadgeAward & {
      badge?: Badge;
      prevLevel?: number;
    },
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof BadgeAwardSchema> => {
    return {
      id: item.id,
      xp: item.xp,
      level: item.level,
      badge: attrs.badge,
      createdAt: item.createdAt.toISOString(),
      ...(item.prevLevel !== undefined ? { prevLevel: item.prevLevel } : {}),
    };
  },
});
