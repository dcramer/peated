import { eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Notification, User } from "../db/schema";
import { comments, follows, tastings, toasts, users } from "../db/schema";
import { loadCatalogTargetReadsWithParity } from "../lib/catalogTargetReadParity";
import { CatalogTargetIntegrityMismatchError } from "../lib/catalogTargets";
import { logError } from "../lib/log";
import { type NotificationSchema } from "../schemas";
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
            targetId: tastings.targetId,
            bottleId: tastings.bottleId,
            releaseId: tastings.releaseId,
          })
          .from(tastings)
          .innerJoin(toasts, eq(tastings.id, toasts.tastingId))
          .where(inArray(toasts.id, toastIdList))
      : [];

    const commentIdList = itemList
      .filter((i) => i.type === "comment")
      .map((i) => i.objectId);
    const commentTastingList = commentIdList.length
      ? await db
          .select({
            objectId: comments.id,
            tastingId: tastings.id,
            targetId: tastings.targetId,
            bottleId: tastings.bottleId,
            releaseId: tastings.releaseId,
          })
          .from(tastings)
          .innerJoin(comments, eq(tastings.id, comments.tastingId))
          .where(inArray(comments.id, commentIdList))
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
    const { targets } = await loadCatalogTargetReadsWithParity(
      tastingReferenceList.map((reference) => ({
        consumerTable: "tasting",
        rowLocator: { id: reference.tastingId },
        targetId: reference.targetId,
        legacy: {
          bottleId: reference.bottleId,
          releaseId: reference.releaseId,
        },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        caller: "NotificationSerializer",
        operation: "serialize_tasting_ref",
      },
    );
    const tastingRefsByKey: Record<string, TastingRef> = {};
    tastingReferenceList.forEach((reference, index) => {
      const target = targets[index];
      if (!target) {
        throw new CatalogTargetIntegrityMismatchError(
          { bottleId: reference.bottleId },
          `notification referenced tasting ${reference.tastingId} has no durable CatalogTarget`,
        );
      }
      tastingRefsByKey[`${reference.type}:${reference.objectId}`] = {
        id: reference.tastingId,
        target,
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
      case "friend_request":
        return { ...common, type: attrs.type, ref: attrs.ref };
      case "toast":
      case "comment":
        return { ...common, type: attrs.type, ref: attrs.ref };
    }
  },
});
