import { inArray } from "drizzle-orm";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Comment, User } from "../db/schema";
import { users } from "../db/schema";
import { UserSerializer } from "./user";

export const CommentSerializer = serializer({
  attrs: async (itemList: Comment[], currentUser?: User) => {
    const userList = await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          itemList.map((i) => i.createdById),
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
            createdBy: usersById[item.createdById],
          },
        ];
      }),
    );
  },

  item: (item: Comment, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      comment: item.comment,
      createdAt: item.createdAt,
      createdBy: attrs.createdBy,
    };
  },
});
