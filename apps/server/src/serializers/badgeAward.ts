import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { badges, type BadgeAward, type User } from "../db/schema";
import { notEmpty } from "../lib/filter";
import type { BadgeAwardSchema } from "../schemas";
import type { Badge } from "../types";
import { BadgeSerializer } from "./badge";

interface BadgeAwardAttrs {
  badge: z.infer<typeof BadgeAwardSchema>["badge"];
}

export const BadgeAwardSerializer = serializer({
  name: "badgeAward",
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
    attrs: BadgeAwardAttrs,
  ): z.infer<typeof BadgeAwardSchema> => {
    const award: z.infer<typeof BadgeAwardSchema> = {
      id: item.id,
      xp: item.xp,
      level: item.level,
      badge: attrs.badge,
      createdAt: item.createdAt.toISOString(),
    };
    if (item.prevLevel !== undefined) award.prevLevel = item.prevLevel;
    return award;
  },
});
