import {
  Notification,
  User,
  comments,
  follows,
  tastings,
  toasts,
  users,
} from "../../db/schema";

import { eq, inArray } from "drizzle-orm";
import { Serializer, serialize } from ".";
import { db } from "../../db";
import { FollowerSerializer } from "./follow";
import { TastingSerializer } from "./tasting";
import { UserSerializer } from "./user";

export const NotificationSerializer: Serializer<Notification> = {
  attrs: async (itemList: Notification[], currentUser: User) => {
    const itemIds = itemList.map((t) => t.id);
    const fromUserIds = itemList
      .filter((i) => !!i.fromUserId)
      .map<number>((i) => i.fromUserId as number);

    const fromUserList = fromUserIds.length
      ? await db.select().from(users).where(inArray(users.id, fromUserIds))
      : [];
    const fromUserById = Object.fromEntries(
      (await serialize(UserSerializer, fromUserList, currentUser)).map(
        (data, index) => [fromUserList[index].id, data],
      ),
    );

    const followIdList = itemList
      .filter((i) => i.objectType === "follow")
      .map((i) => i.objectId);
    const followList = followIdList.length
      ? await db.select().from(follows).where(inArray(follows.id, followIdList))
      : [];
    const followsById = Object.fromEntries(
      (await serialize(FollowerSerializer, followList, currentUser)).map(
        (data, index) => [followList[index].id, data],
      ),
    );

    const toastIdList = itemList
      .filter((i) => i.objectType === "toast")
      .map((i) => i.objectId);
    const toastTastingList = toastIdList.length
      ? await db
          .select({
            toastId: toasts.id,
            tasting: tastings,
          })
          .from(tastings)
          .innerJoin(toasts, eq(tastings.id, toasts.tastingId))
          .where(inArray(toasts.id, toastIdList))
      : [];
    const toastsById = Object.fromEntries(
      (
        await serialize(
          TastingSerializer,
          toastTastingList.map(({ tasting }) => tasting),
          currentUser,
        )
      ).map((data, index) => [toastTastingList[index].toastId, data]),
    );

    const commentIdList = itemList
      .filter((i) => i.objectType === "comment")
      .map((i) => i.objectId);
    const commentTastingList = commentIdList.length
      ? await db
          .select({
            commentId: comments.id,
            tasting: tastings,
          })
          .from(tastings)
          .innerJoin(toasts, eq(tastings.id, comments.tastingId))
          .where(inArray(comments.id, commentIdList))
      : [];
    const commentsById = Object.fromEntries(
      (
        await serialize(
          TastingSerializer,
          commentTastingList.map(({ tasting }) => tasting),
          currentUser,
        )
      ).map((data, index) => [commentTastingList[index].commentId, data]),
    );

    const getRef = (notification: Notification) => {
      switch (notification.objectType) {
        case "follow":
          return followsById[notification.objectId];
        case "toast":
          return toastsById[notification.objectId];
        case "comment":
          return commentsById[notification.objectId];
        default:
          return null;
      }
    };

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            fromUser: item.fromUserId
              ? fromUserById[item.fromUserId]
              : undefined,
            ref: getRef(item) || null,
          },
        ];
      }),
    );
  },

  item: (item: Notification, attrs: Record<string, any>, currentUser: User) => {
    return {
      id: `${item.id}`,
      objectType: item.objectType,
      objectId: item.objectId,
      createdAt: item.createdAt,
      fromUser: attrs.fromUser,
      ref: attrs.ref,
    };
  },
};
