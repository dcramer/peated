import { Follow, User, users } from "../../db/schema";

import { follows } from "../../db/schema";

import { and, eq, inArray } from "drizzle-orm";
import { Serializer, serialize } from ".";
import { db } from "../../db";
import { UserSerializer } from "./user";

export const FollowerSerializer: Serializer<Follow> = {
  attrs: async (itemList: Follow[], currentUser?: User) => {
    const userList = await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          itemList.map((i) => i.fromUserId),
        ),
      );
    const usersById = Object.fromEntries(
      (await serialize(UserSerializer, userList, currentUser)).map(
        (data, index) => [userList[index].id, data],
      ),
    );

    const followsBackByRef = currentUser
      ? Object.fromEntries(
          (
            await db
              .select()
              .from(follows)
              .where(
                and(
                  inArray(
                    follows.toUserId,
                    itemList.map((i) => i.fromUserId),
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
            user: usersById[item.fromUserId],
            followsBack: followsBackByRef[item.fromUserId]?.status || "none",
          },
        ];
      }),
    );
  },
  item: (item: Follow, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      status: item.status,
      createdAt: item.createdAt,
      user: attrs.user,
      followsBack: attrs.followsBack,
    };
  },
};

export const FollowingSerializer: Serializer<Follow> = {
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

    const followsBackByRef = currentUser
      ? Object.fromEntries(
          (
            await db
              .select()
              .from(follows)
              .where(
                and(
                  inArray(
                    follows.fromUserId,
                    itemList.map((i) => i.toUserId),
                  ),
                  eq(follows.toUserId, currentUser.id),
                ),
              )
          ).map((f) => [f.fromUserId, f]),
        )
      : {};

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            user: usersById[item.toUserId],
            followsBack: followsBackByRef[item.toUserId]?.status || "none",
          },
        ];
      }),
    );
  },
  item: (item: Follow, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      status: item.status,
      createdAt: item.createdAt,
      user: attrs.user,
      followsBack: attrs.followsBack,
    };
  },
};
