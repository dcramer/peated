import { db } from "@peated/shared/db";
import type { Comment, User } from "@peated/shared/db/schema";
import { users } from "@peated/shared/db/schema";
import { inArray } from "drizzle-orm";
import type { Serializer } from ".";
import { serialize } from ".";
import { UserSerializer } from "./user";

export const CommentSerializer: Serializer<Comment> = {
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
};
