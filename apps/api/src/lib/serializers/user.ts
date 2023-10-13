import type { User } from "@peated/shared/db/schema";
import { follows } from "@peated/shared/db/schema";
import config from "../../config";

import { db } from "@peated/shared/db";
import { and, eq, inArray } from "drizzle-orm";
import type { Serializer } from ".";

export const UserSerializer: Serializer<User> = {
  attrs: async (itemList: User[], currentUser?: User) => {
    const followsByRef = currentUser
      ? Object.fromEntries(
          (
            await db
              .select()
              .from(follows)
              .where(
                and(
                  inArray(
                    follows.toUserId,
                    itemList.map((i) => i.id),
                  ),
                  eq(follows.fromUserId, currentUser.id),
                ),
              )
          ).map((f) => [f.toUserId, f]),
        )
      : {};

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            friendStatus: followsByRef[item.id]?.status || "none",
          },
        ];
      }),
    );
  },
  item: (item: User, attrs: Record<string, any>, currentUser?: User) => {
    const data = {
      id: item.id,
      displayName: item.displayName,
      username: item.username,
      pictureUrl: item.pictureUrl
        ? `${config.URL_PREFIX}${item.pictureUrl}`
        : null,
      friendStatus:
        attrs.friendStatus === "following" ? "friends" : attrs.friendStatus,
      private: item.private,
    };

    if (
      currentUser &&
      (currentUser.admin || currentUser.mod || currentUser.id === item.id)
    ) {
      return {
        ...data,
        email: item.email,
        createdAt: item.createdAt,
        admin: item.admin,
        mod: item.admin || item.mod,
      };
    }
    return data;
  },
};
