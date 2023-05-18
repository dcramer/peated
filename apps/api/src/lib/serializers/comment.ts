import { inArray } from "drizzle-orm";
import { Serializer } from ".";
import { db } from "../../db";
import { Comment, User, users } from "../../db/schema";

export const CommentSerializer: Serializer<Comment> = {
  attrs: async (itemList: Comment[], currentUser?: User) => {
    const usersById = Object.fromEntries(
      (
        await db
          .select()
          .from(users)
          .where(
            inArray(
              users.id,
              itemList.map((i) => i.createdById),
            ),
          )
      ).map((u) => [u.id, u]),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            createdBy: usersById[item.id],
          },
        ];
      }),
    );
  },

  item: (item: Comment, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: `${item.id}`,
      comments: item.comment,
      createdAt: item.createdAt,
      createdBy: attrs.createdBy,
    };
  },
};
