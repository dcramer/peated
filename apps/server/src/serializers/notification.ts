import { and, eq, inArray, isNull } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Notification, User } from "../db/schema";
import {
  auctionAlerts,
  auctionLots,
  auctions,
  bottles,
  comments,
  externalSites,
  follows,
  tastings,
  toasts,
  users,
} from "../db/schema";
import { logError } from "../lib/log";
import { type NotificationSchema } from "../schemas";
import { BottleSerializer } from "./bottle";
import { UserSerializer } from "./user";

type SerializedNotification = z.infer<typeof NotificationSchema>;
type FriendRequestRef = NonNullable<
  Extract<SerializedNotification, { type: "friend_request" }>["ref"]
>;
type TastingRef = NonNullable<
  Extract<SerializedNotification, { type: "toast" }>["ref"]
>;

type NotificationAttrs = {
  fromUser: ReturnType<(typeof UserSerializer)["item"]> | null;
} & (
  | {
      type: "auction_available";
      ref: Extract<
        SerializedNotification,
        { type: "auction_available" }
      >["ref"];
    }
  | {
      type: "friend_request";
      ref: FriendRequestRef | null;
    }
  | {
      type: "toast" | "comment";
      ref: TastingRef | null;
    }
);

export const NotificationSerializer = serializer({
  name: "notification",
  attrs: async (
    itemList: Notification[],
    currentUser: User,
  ): Promise<Record<number, NotificationAttrs>> => {
    const fromUserIds = Array.from(
      new Set(
        itemList.flatMap((item) =>
          item.fromUserId === null ? [] : [item.fromUserId],
        ),
      ),
    );

    const fromUserList = fromUserIds.length
      ? await db.select().from(users).where(inArray(users.id, fromUserIds))
      : [];
    const fromUserById = Object.fromEntries(
      (await serialize(UserSerializer, fromUserList, currentUser)).map(
        (data, index) => [fromUserList[index].id, data],
      ),
    );
    if (fromUserIds.length !== fromUserList.length) {
      logError("Failed to fetch all fromUser relations for notifications");
    }

    const followIdList = itemList
      .filter((i) => i.type === "friend_request")
      .map((i) => i.objectId);
    const followList = followIdList.length
      ? await db
          .select({
            id: follows.id,
            fromUserId: follows.fromUserId,
            toUserId: follows.toUserId,
            status: follows.status,
          })
          .from(follows)
          .where(inArray(follows.id, followIdList))
      : [];
    const followsById = new Map<number, (typeof followList)[number]>();
    for (const follow of followList) {
      followsById.set(follow.id, follow);
    }
    if (followIdList.length !== followList.length) {
      logError("Failed to fetch all follow relations for notifications");
    }

    const toastIdList = itemList
      .filter((i) => i.type === "toast")
      .map((i) => i.objectId);
    const toastTastingList = toastIdList.length
      ? await db
          .select({
            objectId: toasts.id,
            tastingId: tastings.id,
            bottleId: tastings.bottleId,
          })
          .from(tastings)
          .innerJoin(toasts, eq(tastings.id, toasts.tastingId))
          .where(
            and(inArray(toasts.id, toastIdList), isNull(tastings.removedAt)),
          )
      : [];

    const commentIdList = itemList
      .filter((i) => i.type === "comment")
      .map((i) => i.objectId);
    const commentTastingList = commentIdList.length
      ? await db
          .select({
            objectId: comments.id,
            tastingId: tastings.id,
            bottleId: tastings.bottleId,
          })
          .from(tastings)
          .innerJoin(comments, eq(tastings.id, comments.tastingId))
          .where(
            and(
              inArray(comments.id, commentIdList),
              isNull(tastings.removedAt),
            ),
          )
      : [];
    const tastingReferenceList = [
      ...toastTastingList.map((reference) => ({
        ...reference,
        type: "toast" as const,
      })),
      ...commentTastingList.map((reference) => ({
        ...reference,
        type: "comment" as const,
      })),
    ];
    const directBottleReferences = tastingReferenceList.map((reference) => {
      if (reference.bottleId === null) {
        throw new Error(`Tasting ${reference.tastingId} has no Bottle.`);
      }
      return { ...reference, bottleId: reference.bottleId };
    });
    const auctionAlertIds = itemList
      .filter((item) => item.type === "auction_available")
      .map((item) => item.objectId);
    const alertRows = auctionAlertIds.length
      ? await db
          .select({
            id: auctionAlerts.id,
            userId: auctionAlerts.userId,
            bottleId: auctionAlerts.bottleId,
            lotId: auctionLots.id,
            url: auctionLots.url,
            sourceName: externalSites.name,
          })
          .from(auctionAlerts)
          .innerJoin(
            auctionLots,
            and(
              eq(auctionAlerts.lotId, auctionLots.id),
              eq(auctionAlerts.bottleId, auctionLots.bottleId),
            ),
          )
          .innerJoin(auctions, eq(auctionLots.auctionId, auctions.id))
          .innerJoin(
            externalSites,
            eq(auctions.externalSiteId, externalSites.id),
          )
          .where(
            and(
              inArray(auctionAlerts.id, auctionAlertIds),
              eq(auctionAlerts.userId, currentUser.id),
            ),
          )
      : [];
    const alertsById = new Map(alertRows.map((alert) => [alert.id, alert]));
    const bottleIds = Array.from(
      new Set(directBottleReferences.map((reference) => reference.bottleId)),
    );
    bottleIds.push(...alertRows.map((alert) => alert.bottleId));
    const bottleList = bottleIds.length
      ? await db.select().from(bottles).where(inArray(bottles.id, bottleIds))
      : [];
    const serializedBottleList = await serialize(
      BottleSerializer,
      bottleList,
      currentUser,
      [],
      { includeGroupSummary: true },
    );
    const bottlesById = new Map(
      serializedBottleList.map((bottle, index) => [
        bottleList[index].id,
        bottle,
      ]),
    );
    const tastingRefsByKey: Record<string, TastingRef> = {};
    directBottleReferences.forEach((reference) => {
      const bottle = bottlesById.get(reference.bottleId);
      if (!bottle) {
        throw new Error(
          `Tasting ${reference.tastingId} references missing Bottle ${reference.bottleId}.`,
        );
      }
      tastingRefsByKey[`${reference.type}:${reference.objectId}`] = {
        id: reference.tastingId,
        bottle,
      };
    });

    const getFriendRequestRef = (
      notification: Notification,
    ): FriendRequestRef | null => {
      const follow = followsById.get(notification.objectId);
      if (!follow) return null;

      if (
        follow.fromUserId !== notification.fromUserId ||
        follow.toUserId !== notification.userId
      ) {
        logError("Notification friend request identity mismatch", {
          notification: {
            id: notification.id,
            objectId: notification.objectId,
            fromUserId: notification.fromUserId,
            userId: notification.userId,
          },
          follow: {
            id: follow.id,
            fromUserId: follow.fromUserId,
            toUserId: follow.toUserId,
          },
        });
        return null;
      }

      return {
        status: follow.status === "following" ? "friends" : follow.status,
        userId: follow.fromUserId,
      };
    };

    const getAttrs = (notification: Notification): NotificationAttrs => {
      const fromUser = notification.fromUserId
        ? fromUserById[notification.fromUserId]
        : null;

      switch (notification.type) {
        case "auction_available": {
          const alert = alertsById.get(notification.objectId);
          const bottle = alert ? bottlesById.get(alert.bottleId) : null;
          return {
            type: notification.type,
            fromUser: null,
            ref:
              alert && bottle
                ? {
                    lotId: alert.lotId,
                    bottle,
                    url: alert.url,
                    sourceName: alert.sourceName,
                  }
                : null,
          };
        }
        case "friend_request":
          return {
            type: notification.type,
            fromUser,
            ref: getFriendRequestRef(notification),
          };
        case "toast":
          return {
            type: notification.type,
            fromUser,
            ref: tastingRefsByKey[`toast:${notification.objectId}`] ?? null,
          };
        case "comment":
          return {
            type: notification.type,
            fromUser,
            ref: tastingRefsByKey[`comment:${notification.objectId}`] ?? null,
          };
      }
    };

    return Object.fromEntries(
      itemList.map((item) => [item.id, getAttrs(item)]),
    );
  },

  item: (
    item: Notification,
    attrs: NotificationAttrs,
    currentUser: User,
  ): z.infer<typeof NotificationSchema> => {
    const common = {
      id: item.id,
      objectId: item.objectId,
      createdAt: item.createdAt.toISOString(),
      fromUser: attrs.fromUser,
      read: item.read,
    };

    switch (attrs.type) {
      case "auction_available":
        return { ...common, type: attrs.type, ref: attrs.ref };
      case "friend_request":
        return { ...common, type: attrs.type, ref: attrs.ref };
      case "toast":
      case "comment":
        return { ...common, type: attrs.type, ref: attrs.ref };
    }
  },
});
