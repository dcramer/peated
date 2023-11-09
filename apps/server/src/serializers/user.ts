import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { User } from "../db/schema";
import { follows } from "../db/schema";
import { type UserSchema } from "../schemas";

export const UserSerializer = serializer({
  attrs: async (itemList: User[], currentUser) => {
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
  item: (item: User, attrs, currentUser): z.infer<typeof UserSchema> => {
    const data = {
      id: item.id,
      displayName: item.displayName,
      username: item.username,
      pictureUrl: item.pictureUrl
        ? `${config.API_SERVER}${item.pictureUrl}`
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
        createdAt: item.createdAt.toISOString(),
        admin: item.admin,
        mod: item.admin || item.mod,
      };
    }
    return data;
  },
});
