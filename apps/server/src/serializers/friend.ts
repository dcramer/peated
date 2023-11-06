import { inArray } from "drizzle-orm";
import type { Serializer } from ".";
import { serialize } from ".";
import { db } from "../db";
import type { Follow, User } from "../db/schema";
import { users } from "../db/schema";
import { UserSerializer } from "./user";

export const FriendSerializer: Serializer<Follow> = {
  attrs: async (itemList: Follow[], currentUser?: User) => {
    const userList = await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          itemList.map((i) => i.toUserId),
        ),
      );
    const usersById = Object.fromEntries(
      (await serialize(UserSerializer, userList, currentUser)).map(
        (data, index) => [userList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            user: usersById[item.toUserId],
          },
        ];
      }),
    );
  },
  item: (item: Follow, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: attrs.user.id,
      status: item.status === "following" ? "friends" : item.status,
      createdAt: item.createdAt,
      user: attrs.user,
    };
  },
};
