import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Tasting, User } from "../db/schema";
import { bottles, tastingBadgeAwards, toasts, users } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import { type TastingSchema } from "../schemas";
import type { TagCategory } from "../types";
import { BadgeAwardSerializer } from "./badgeAward";
import { BottleSerializer, bottleRowColumns, type BottleRow } from "./bottle";
import { categoriesForTags, loadTagCategories } from "./tagCategories";
import { UserSerializer } from "./user";

type TastingAttrs = {
  hasToasted: boolean;
  createdBy: ReturnType<(typeof UserSerializer)["item"]>;
  bottle: ReturnType<(typeof BottleSerializer)["item"]>;
  friends: ReturnType<(typeof UserSerializer)["item"]>[];
  awards: ReturnType<(typeof BadgeAwardSerializer)["item"]>[];
  tagCategories: Record<string, TagCategory>;
};

async function loadSerializedBottles(bottleIds: number[], currentUser?: User) {
  const bottleList = bottleIds.length
    ? await db
        .select(bottleRowColumns)
        .from(bottles)
        .where(inArray(bottles.id, bottleIds))
    : [];
  const bottlesById = new Map<number, BottleRow>(
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
    [],
    { includeGroupSummary: true },
  );
  return new Map(
    bottleList.map((bottle, index) => [bottle.id, serializedBottles[index]!]),
  );
}

async function loadToastedTastingIds(
  tastingIds: number[],
  currentUser?: User,
): Promise<number[]> {
  if (!currentUser) return [];
  const rows = await db
    .select({ tastingId: toasts.tastingId })
    .from(toasts)
    .where(
      and(
        inArray(toasts.tastingId, tastingIds),
        eq(toasts.createdById, currentUser.id),
      ),
    );
  return rows.map((t) => t.tastingId);
}

async function loadSerializedUsers(userIds: number[], currentUser?: User) {
  if (!userIds.length)
    return new Map<number, ReturnType<(typeof UserSerializer)["item"]>>();
  const userList = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));
  const serialized = await serialize(UserSerializer, userList, currentUser);
  return new Map(userList.map((user, index) => [user.id, serialized[index]!]));
}

async function loadAwardsByTasting(tastingIds: number[], currentUser?: User) {
  const tastingAwardList = await db.query.tastingBadgeAwards.findMany({
    where: inArray(tastingBadgeAwards.tastingId, tastingIds),
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
  return awardsByTasting;
}

export const TastingSerializer = serializer({
  name: "tasting",
  attrs: async (
    itemList: Tasting[],
    currentUser?: User,
  ): Promise<Record<string, TastingAttrs>> => {
    const itemIds = itemList.map((t) => t.id);
    const bottleIds = [...new Set(itemList.map(({ bottleId }) => bottleId))];
    const creatorIds = [...new Set(itemList.map((item) => item.createdById))];
    const friendIds = Array.from(
      new Set<number>(itemList.map((r) => r.friends).flat()),
    );

    // Each load below depends only on the tastings, so they run together
    // instead of paying one database round trip after another.
    const [
      categoriesByTag,
      serializedBottleById,
      userToastsList,
      usersById,
      awardsByTasting,
    ] = await Promise.all([
      loadTagCategories(itemList.flatMap((item) => item.tags ?? [])),
      loadSerializedBottles(bottleIds, currentUser),
      loadToastedTastingIds(itemIds, currentUser),
      loadSerializedUsers(
        [...new Set([...creatorIds, ...friendIds])],
        currentUser,
      ),
      loadAwardsByTasting(itemIds, currentUser),
    ]);

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
            createdBy: usersById.get(item.createdById)!,
            bottle,
            friends: item.friends.map((f) => usersById.get(f)).filter(notEmpty),
            awards: awardsByTasting[item.id] || [],
            tagCategories: categoriesForTags(item.tags ?? [], categoriesByTag),
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
      tagCategories: attrs.tagCategories,
      color: item.color,
      ratingBand: item.ratingBand,
      // TODO(ratings): Remove these fields when historical rating display is retired.
      legacySimpleRating: z
        .union([z.literal(-1), z.literal(1), z.literal(2)])
        .nullable()
        .parse(item.legacySimpleRating),
      legacyStarRating: item.legacyStarRating,
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
