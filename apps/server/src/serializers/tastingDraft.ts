import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { TastingDraft, User } from "../db/schema";
import { bottles, users } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import { type TastingDraftSchema } from "../schemas";
import { BottleSerializer, bottleRowColumns } from "./bottle";
import { UserSerializer } from "./user";

type TastingDraftAttrs = {
  bottle: ReturnType<(typeof BottleSerializer)["item"]> | null;
  friends: ReturnType<(typeof UserSerializer)["item"]>[];
};

export const TastingDraftSerializer = serializer({
  name: "tastingDraft",
  attrs: async (
    itemList: TastingDraft[],
    currentUser?: User,
  ): Promise<Record<string, TastingDraftAttrs>> => {
    const bottleIds = [
      ...new Set(itemList.map(({ bottleId }) => bottleId).filter(notEmpty)),
    ];
    const friendIds = [...new Set(itemList.flatMap(({ friends }) => friends))];

    const [bottleList, friendList] = await Promise.all([
      bottleIds.length
        ? db
            .select(bottleRowColumns)
            .from(bottles)
            .where(inArray(bottles.id, bottleIds))
        : [],
      friendIds.length
        ? db.select().from(users).where(inArray(users.id, friendIds))
        : [],
    ]);
    const [serializedBottles, serializedFriends] = await Promise.all([
      serialize(BottleSerializer, bottleList, currentUser),
      serialize(UserSerializer, friendList, currentUser),
    ]);
    const bottlesById = new Map(
      bottleList.map((bottle, index) => [bottle.id, serializedBottles[index]]),
    );
    const friendsById = new Map(
      friendList.map((user, index) => [user.id, serializedFriends[index]]),
    );

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          bottle: item.bottleId
            ? (bottlesById.get(item.bottleId) ?? null)
            : null,
          friends: item.friends
            .map((id) => friendsById.get(id))
            .filter(notEmpty),
        },
      ]),
    );
  },

  item: (
    item: TastingDraft,
    attrs: TastingDraftAttrs,
  ): z.infer<typeof TastingDraftSchema> => {
    return {
      id: item.id,
      tastedAt: item.tastedAt.toISOString(),
      bottleHint: item.bottleHint,
      bottle: attrs.bottle,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      notes: item.notes,
      ratingBand: item.ratingBand,
      tags: item.tags,
      color: item.color,
      servingStyle: item.servingStyle,
      friends: attrs.friends,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
