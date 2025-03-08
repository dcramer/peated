import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Comment, User } from "../db/schema";
import { users } from "../db/schema";
import { type CommentSchema } from "../schemas";
import { UserSerializer } from "./user";

export const CommentSerializer = serializer({
  attrs: async (itemList: Comment[], currentUser?: User) => {
    if (itemList.length === 0) return {};

    // Get all creator user IDs
    const userIds = new Set<number>();
    itemList.forEach((item) => {
      userIds.add(item.createdById);
    });

    const userList = await db
      .select()
      .from(users)
      .where(inArray(users.id, Array.from(userIds)));

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

  item: (
    item: Comment,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof CommentSchema> => {
    // Extract mentioned usernames from the mentions field
    const mentionedUsernames = item.mentions ? item.mentions.split(",") : [];

    // Create a basic comment object
    return {
      id: item.id,
      comment: item.comment,
      createdAt: item.createdAt.toISOString(),
      createdBy: attrs.createdBy,
      replyToId: item.parentId || null,
      mentionedUsernames: mentionedUsernames,
    };
  },
});
