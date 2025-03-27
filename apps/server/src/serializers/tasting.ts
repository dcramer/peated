import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Tasting, User } from "../db/schema";
import {
  bottleReleases,
  bottles,
  tastingBadgeAwards,
  tastings,
  toasts,
  users,
} from "../db/schema";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import { type TastingSchema } from "../schemas";
import { BadgeAwardSerializer } from "./badgeAward";
import { BottleSerializer } from "./bottle";
import { BottleReleaseSerializer } from "./bottleRelease";
import { UserSerializer } from "./user";

type TastingAttrs = {
  hasToasted: boolean;
  createdBy: ReturnType<(typeof UserSerializer)["item"]>;
  bottle: ReturnType<(typeof BottleSerializer)["item"]>;
  release: ReturnType<(typeof BottleReleaseSerializer)["item"]> | null;
  friends: ReturnType<(typeof UserSerializer)["item"]>[];
  awards: ReturnType<(typeof BadgeAwardSerializer)["item"]>[];
};

export const TastingSerializer = serializer({
  attrs: async (
    itemList: Tasting[],
    currentUser?: User,
  ): Promise<Record<string, TastingAttrs>> => {
    const itemIds = itemList.map((t) => t.id);
    const results = await db
      .select({
        id: tastings.id,
        bottle: bottles,
        release: bottleReleases,
        createdBy: users,
      })
      .from(tastings)
      .innerJoin(users, eq(tastings.createdById, users.id))
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .leftJoin(bottleReleases, eq(tastings.releaseId, bottleReleases.id))
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

    const releasesByRef = Object.fromEntries(
      (
        await serialize(
          BottleReleaseSerializer,
          results.map((r) => r.release),
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
        return [
          item.id,
          {
            hasToasted: userToastsList.includes(item.id),
            createdBy: usersByRef[item.id],
            bottle: bottlesByRef[item.id],
            release: releasesByRef[item.id],
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
      rating: item.rating,
      servingStyle: item.servingStyle,
      friends: attrs.friends,

      createdAt: item.createdAt.toISOString(),

      comments: item.comments,
      toasts: item.toasts,

      awards: attrs.awards,

      bottle: attrs.bottle,
      release: attrs.release,
      createdBy: attrs.createdBy,
      hasToasted: attrs.hasToasted,
    };
  },
});
