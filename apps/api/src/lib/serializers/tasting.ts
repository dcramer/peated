import { db } from "@peated/shared/db";
import type { Tasting, User } from "@peated/shared/db/schema";
import { bottles, tastings, toasts, users } from "@peated/shared/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Serializer } from ".";
import { serialize } from ".";
import config from "../../config";
import { notEmpty } from "../filter";
import { BottleSerializer } from "./bottle";
import { UserSerializer } from "./user";

export const TastingSerializer: Serializer<Tasting> = {
  attrs: async (itemList: Tasting[], currentUser?: User) => {
    const itemIds = itemList.map((t) => t.id);
    const results = await db
      .select({
        id: tastings.id,
        bottle: bottles,
        createdBy: users,
      })
      .from(tastings)
      .innerJoin(users, eq(tastings.createdById, users.id))
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .where(inArray(tastings.id, itemIds));

    const userToastsList: number[] = currentUser
      ? (
          await db
            .select({ tastingId: toasts.tastingId })
            .from(toasts)
            .where(
              and(
                inArray(toasts.tastingId, itemIds),
                eq(toasts.createdById, currentUser.id),
              ),
            )
        ).map((t) => t.tastingId)
      : [];

    const bottlesByRef = Object.fromEntries(
      (
        await serialize(
          BottleSerializer,
          results.map((r) => r.bottle),
          currentUser,
        )
      ).map((data, index) => [results[index].id, data]),
    );

    // TODO: combine friends + createdBy
    const usersByRef = Object.fromEntries(
      (
        await serialize(
          UserSerializer,
          results.map((r) => r.createdBy),
          currentUser,
        )
      ).map((data, index) => [results[index].id, data]),
    );

    const friendIds = Array.from(
      new Set<number>(itemList.map((r) => r.friends).flat()),
    );
    const usersById = friendIds.length
      ? Object.fromEntries(
          (
            await serialize(
              UserSerializer,
              await db.select().from(users).where(inArray(users.id, friendIds)),
              currentUser,
            )
          ).map((data) => [data.id, data]),
        )
      : {};

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            hasToasted: userToastsList.indexOf(item.id) !== -1,
            createdBy: usersByRef[item.id] || null,
            bottle: bottlesByRef[item.id] || null,
            friends: item.friends.map((f) => usersById[f]).filter(notEmpty),
          },
        ];
      }),
    );
  },

  item: (item: Tasting, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      imageUrl: item.imageUrl ? `${config.URL_PREFIX}${item.imageUrl}` : null,
      notes: item.notes,
      tags: item.tags || [],
      rating: item.rating,
      servingStyle: item.servingStyle,
      friends: attrs.friends,

      createdAt: item.createdAt,

      comments: item.comments,
      toasts: item.toasts,

      bottle: attrs.bottle,
      createdBy: attrs.createdBy,
      hasToasted: attrs.hasToasted,
    };
  },
};
