import { type z } from "zod";
import { serialize, serializer } from ".";
import type { Follow, User } from "../db/schema";
import { type FriendSchema } from "../schemas";
import { UserSerializer } from "./user";

type FriendEntry = Follow & { toUser: User };

export const FriendSerializer = serializer({
  name: "friend",
  attrs: async (itemList: FriendEntry[], currentUser?: User) => {
    const userList = itemList.map((i) => i.toUser);
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
  item: (
    item: FriendEntry,
    attrs: {
      user: ReturnType<(typeof UserSerializer)["item"]>;
    },
    currentUser?: User,
  ): z.infer<typeof FriendSchema> => {
    return {
      id: attrs.user.id,
      status: item.status === "following" ? "friends" : item.status,
      createdAt: item.createdAt.toISOString(),
      user: attrs.user,
    };
  },
});
