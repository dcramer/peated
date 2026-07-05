import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Actor, User } from "../db/schema";
import { users } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import { type ActorSchema } from "../schemas";
import { UserSerializer } from "./user";

type ActorAttrs = {
  user: ReturnType<(typeof UserSerializer)["item"]> | null;
};

export const ActorSerializer = serializer({
  name: "actor",
  attrs: async (
    itemList: Actor[],
    currentUser: User | null,
  ): Promise<Record<number, ActorAttrs>> => {
    const userIds = Array.from(
      new Set(
        itemList
          .filter((item) => Boolean(item.userId))
          .map((item) => item.userId as number),
      ),
    );

    const userList = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const usersById = Object.fromEntries(
      (await serialize(UserSerializer, userList, currentUser)).map(
        (data, index) => [userList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          user: item.userId ? (usersById[item.userId] ?? null) : null,
        },
      ]),
    );
  },

  item: (item: Actor, attrs: ActorAttrs): z.infer<typeof ActorSchema> => {
    return {
      id: item.id,
      type: item.type,
      key: item.key,
      displayName: item.displayName,
      pictureUrl: item.pictureUrl
        ? absoluteUrl(config.API_SERVER, item.pictureUrl)
        : null,
      user: attrs.user,
    };
  },
});
