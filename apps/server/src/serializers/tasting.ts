import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Tasting, User } from "../db/schema";
import { tastingBadgeAwards, toasts, users } from "../db/schema";
import { loadCatalogTargetReadsWithParity } from "../lib/catalogTargetReadParity";
import { CatalogTargetIntegrityMismatchError } from "../lib/catalogTargets";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import { type TastingSchema } from "../schemas";
import type { CatalogTargetV1 } from "../schemas/catalogIdentity";
import { BadgeAwardSerializer } from "./badgeAward";
import { UserSerializer } from "./user";

type TastingAttrs = {
  hasToasted: boolean;
  createdBy: ReturnType<(typeof UserSerializer)["item"]>;
  target: CatalogTargetV1;
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
    const { targets } = await loadCatalogTargetReadsWithParity(
      itemList.map((item) => ({
        consumerTable: "tasting",
        rowLocator: { id: item.id },
        targetId: item.targetId,
        legacy: { bottleId: item.bottleId, releaseId: item.releaseId },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        caller: "TastingSerializer",
        operation: "serialize",
      },
    );
    const targetByTastingId = Object.fromEntries(
      itemList.map((item, index) => {
        const target = targets[index];
        if (!target) {
          if (item.targetId === null && item.bottleId === null) {
            throw new Error(`tasting ${item.id} has no catalog identity`);
          }
          throw new CatalogTargetIntegrityMismatchError(
            item.targetId !== null
              ? { targetId: item.targetId }
              : { bottleId: item.bottleId! },
            `tasting ${item.id} has no durable CatalogTarget`,
          );
        }
        return [item.id, target];
      }),
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
        return [
          item.id,
          {
            hasToasted: userToastsList.includes(item.id),
            createdBy: creatorsById[item.createdById],
            target: targetByTastingId[item.id],
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

      target: attrs.target,
      createdBy: attrs.createdBy,
      hasToasted: attrs.hasToasted,
    };
  },
});
