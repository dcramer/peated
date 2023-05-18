import { and, eq, inArray } from "drizzle-orm";
import { Serializer, serialize } from ".";
import config from "../../config";
import { db } from "../../db";
import {
  Tasting,
  User,
  bottles,
  editions,
  tastings,
  toasts,
  users,
} from "../../db/schema";
import { notEmpty } from "../filter";
import { BottleSerializer } from "./bottle";
import { EditionSerializer } from "./edition";
import { UserSerializer } from "./user";

export const TastingSerializer: Serializer<Tasting> = {
  attrs: async (itemList: Tasting[], currentUser?: User) => {
    const itemIds = itemList.map((t) => t.id);
    const results = await db
      .select({
        id: tastings.id,
        bottle: bottles,
        createdBy: users,
        edition: editions,
      })
      .from(tastings)
      .innerJoin(users, eq(tastings.createdById, users.id))
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .leftJoin(editions, eq(tastings.editionId, editions.id))
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

    const usersByRef = Object.fromEntries(
      (
        await serialize(
          UserSerializer,
          results.map((r) => r.createdBy),
          currentUser,
        )
      ).map((data, index) => [results[index].id, data]),
    );

    const editionList = results.map((r) => r.edition).filter(notEmpty);

    const editionsByRef = Object.fromEntries(
      (await serialize(EditionSerializer, editionList, currentUser)).map(
        (data, index) => [editionList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            hasToasted: userToastsList.indexOf(item.id) !== -1,
            edition: item.editionId ? editionsByRef[item.id] : null,
            createdBy: usersByRef[item.id] || null,
            bottle: bottlesByRef[item.id] || null,
          },
        ];
      }),
    );
  },

  item: (item: Tasting, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: `${item.id}`,
      imageUrl: item.imageUrl ? `${config.URL_PREFIX}${item.imageUrl}` : null,
      notes: item.notes,
      tags: item.tags || [],
      rating: item.rating,
      createdAt: item.createdAt,

      comments: item.comments,
      toasts: item.toasts,

      bottle: attrs.bottle,
      createdBy: attrs.createdBy,
      edition: attrs.edition,
      hasToasted: attrs.hasToasted,
    };
  },
};
