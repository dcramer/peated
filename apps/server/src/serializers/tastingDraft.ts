import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { TastingDraft, User } from "../db/schema";
import { bottles, follows, users } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { serializeProposedBottle } from "../lib/photoIdentification";
import { absoluteUrl } from "../lib/urls";
import {
  PersistedTastingDraftIdentificationSchema,
  type TastingDraftSchema,
} from "../schemas";
import { bottleRowColumns, BottleSerializer } from "./bottle";
import { UserSerializer } from "./user";

type TastingDraftAttrs = {
  bottle: ReturnType<(typeof BottleSerializer)["item"]> | null;
  friends: ReturnType<(typeof UserSerializer)["item"]>[];
  identificationResult: z.infer<
    typeof TastingDraftSchema
  >["identification"]["result"];
};

export const TastingDraftSerializer = serializer({
  name: "tastingDraft",
  attrs: async (
    itemList: TastingDraft[],
    currentUser?: User,
  ): Promise<Record<string, TastingDraftAttrs>> => {
    const identifications = new Map(
      itemList.map((item) => [
        item.id,
        item.identificationStatus === "done"
          ? PersistedTastingDraftIdentificationSchema.parse(item.identification)
          : null,
      ]),
    );
    const matchedIds = [...identifications.values()].flatMap((result) =>
      result?.action === "match" ? [result.bottleId] : [],
    );
    const bottleIds = [
      ...new Set(
        [...itemList.map(({ bottleId }) => bottleId), ...matchedIds].filter(
          notEmpty,
        ),
      ),
    ];
    const friendIds = [...new Set(itemList.flatMap(({ friends }) => friends))];
    const ownerIds = [
      ...new Set(itemList.map(({ createdById }) => createdById)),
    ];

    const [bottleList, friendList, followList] = await Promise.all([
      bottleIds.length
        ? db
            .select(bottleRowColumns)
            .from(bottles)
            .where(inArray(bottles.id, bottleIds))
        : [],
      friendIds.length
        ? db.select().from(users).where(inArray(users.id, friendIds))
        : [],
      friendIds.length
        ? db
            .select({
              fromUserId: follows.fromUserId,
              toUserId: follows.toUserId,
            })
            .from(follows)
            .where(
              and(
                inArray(follows.fromUserId, ownerIds),
                inArray(follows.toUserId, friendIds),
                eq(follows.status, "following"),
              ),
            )
        : [],
    ]);
    // Saving or posting a draft drops friends its owner no longer follows
    // (keepFollowedFriends), so don't show them either.
    const followed = new Set(
      followList.map(({ fromUserId, toUserId }) => `${fromUserId}:${toUserId}`),
    );
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

    const serializeResult = (
      result: z.infer<typeof PersistedTastingDraftIdentificationSchema> | null,
    ): TastingDraftAttrs["identificationResult"] => {
      switch (result?.action) {
        case undefined:
          return null;
        case "match": {
          const bottle = bottlesById.get(result.bottleId);
          // The matched Bottle was merged or deleted since; search instead.
          return bottle ? { action: "match", bottle } : { action: "no_match" };
        }
        case "create_bottle":
          return {
            action: "create_bottle",
            proposedBottle: serializeProposedBottle(
              result.decision.proposedBottle,
            ),
          };
        case "no_match":
          return { action: "no_match" };
      }
    };

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          bottle: item.bottleId
            ? (bottlesById.get(item.bottleId) ?? null)
            : null,
          friends: item.friends
            .filter((id) => followed.has(`${item.createdById}:${id}`))
            .map((id) => friendsById.get(id))
            .filter(notEmpty),
          identificationResult: serializeResult(
            identifications.get(item.id) ?? null,
          ),
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
      identification: {
        status: item.identificationStatus,
        result: attrs.identificationResult,
      },
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
