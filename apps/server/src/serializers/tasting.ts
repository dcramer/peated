import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Bottle, Tasting, User } from "../db/schema";
import { bottles, tastingBadgeAwards, toasts, users } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import { type TastingSchema } from "../schemas";
import { BadgeAwardSerializer } from "./badgeAward";
import { BottleSerializer } from "./bottle";
import { UserSerializer } from "./user";

type TastingAttrs = {
  hasToasted: boolean;
  createdBy: ReturnType<(typeof UserSerializer)["item"]>;
  bottle: ReturnType<(typeof BottleSerializer)["item"]>;
  friends: ReturnType<(typeof UserSerializer)["item"]>[];
  awards: ReturnType<(typeof BadgeAwardSerializer)["item"]>[];
};

export const TastingSerializer = serializer({
  name: "tasting",
  attrs: async (
    itemList: Tasting[],
    currentUser?: User,
  ): Promise<Record<string, TastingAttrs>> => {
    const itemIds = itemList.map((t) => t.id);
    const bottleIds = [...new Set(itemList.map(({ bottleId }) => bottleId))];
    const bottleList = bottleIds.length
      ? await db.select().from(bottles).where(inArray(bottles.id, bottleIds))
      : [];
    const bottlesById = new Map<number, Bottle>(
      bottleList.map((bottle) => [bottle.id, bottle]),
    );
    for (const bottleId of bottleIds) {
      if (!bottlesById.has(bottleId)) {
        throw new Error(`Tasting references missing Bottle ${bottleId}.`);
      }
    }
    const serializedBottles = await serialize(
      BottleSerializer,
      bottleList,
      currentUser,
    );
    const serializedBottleById = new Map(
      bottleList.map((bottle, index) => [bottle.id, serializedBottles[index]!]),
    );

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

    // TODO: combine friends + createdBy
    const creatorIds = [...new Set(itemList.map((item) => item.createdById))];
    const creatorList = creatorIds.length
      ? await db.select().from(users).where(inArray(users.id, creatorIds))
      : [];
    const creatorsById = Object.fromEntries(
      (await serialize(UserSerializer, creatorList, currentUser)).map(
        (data, index) => [creatorList[index].id, data],
      ),
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

    // this is extremely inefficient, especially without response compression
    const tastingAwardList = await db.query.tastingBadgeAwards.findMany({
      where: inArray(tastingBadgeAwards.tastingId, itemIds),
      with: {
        award: {
          with: {
            badge: true,
          },
        },
      },
    });

    const awardsByRef = Object.fromEntries(
      (
        await serialize(
          BadgeAwardSerializer,
          tastingAwardList.map((t) => t.award),
          currentUser,
        )
      ).map((data, index) => [tastingAwardList[index].award.id, data]),
    );

    const awardsByTasting: Record<
      string,
      ReturnType<(typeof BadgeAwardSerializer)["item"]>[]
    > = {};
    for (const tastingAward of tastingAwardList) {
      if (!awardsByTasting[tastingAward.tastingId])
        awardsByTasting[tastingAward.tastingId] = [];
      awardsByTasting[tastingAward.tastingId].push(
        awardsByRef[tastingAward.award.id],
      );
    }

    return Object.fromEntries(
      itemList.map((item) => {
        const bottle = serializedBottleById.get(item.bottleId);
        if (!bottle) {
          throw new Error(
            `Tasting ${item.id} references missing Bottle ${item.bottleId}.`,
          );
        }
        return [
          item.id,
          {
            hasToasted: userToastsList.includes(item.id),
            createdBy: creatorsById[item.createdById],
            bottle,
            friends: item.friends.map((f) => usersById[f]).filter(notEmpty),
            awards: awardsByTasting[item.id] || [],
          },
        ];
      }),
    );
  },

  item: (
    item: Tasting,
    attrs: TastingAttrs,
    currentUser?: User,
  ): z.infer<typeof TastingSchema> => {
    return {
      id: item.id,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      notes: item.notes,
      tags: item.tags || [],
      color: item.color,
      rating: item.rating as -1 | 1 | 2 | null,
      servingStyle: item.servingStyle,
      friends: attrs.friends,

      createdAt: item.createdAt.toISOString(),

      comments: item.comments,
      toasts: item.toasts,

      awards: attrs.awards,

      bottle: attrs.bottle,
      createdBy: attrs.createdBy,
      hasToasted: attrs.hasToasted,
    };
  },
});
