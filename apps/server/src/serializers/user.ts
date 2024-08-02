import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { User } from "../db/schema";
import { follows } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
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
    return {
      id: item.id,
      username: item.username,
      pictureUrl: item.pictureUrl
        ? absoluteUrl(config.API_SERVER, item.pictureUrl)
        : null,
      friendStatus:
        attrs.friendStatus === "following" ? "friends" : attrs.friendStatus,
      private: item.private,
      ...(currentUser &&
      (currentUser.admin || currentUser.mod || currentUser.id === item.id)
        ? {
            email: item.email,
            createdAt: item.createdAt.toISOString(),
            verified: item.verified,
            admin: item.admin,
            mod: item.admin || item.mod,
            notifyComments: item.notifyComments,
          }
        : {}),
    };
  },
});
