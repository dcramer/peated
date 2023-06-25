import config from "../../config";
import type { User } from "../../db/schema";
import { follows } from "../../db/schema";

import { and, eq, inArray } from "drizzle-orm";
import type { Serializer } from ".";
import { db } from "../../db";

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
            followStatus: followsByRef[item.id]?.status || "none",
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
      followStatus: attrs.followStatus,
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
