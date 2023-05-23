import { Activity, User, users } from "../../db/schema";

import { inArray } from "drizzle-orm";
import { Serializer, serialize } from ".";
import { db } from "../../db";
import { logError } from "../log";
import { UserSerializer } from "./user";

export const ActivitySerializer: Serializer<Activity> = {
  attrs: async (itemList: Activity[], currentUser: User) => {
    const createdByIds = Array.from(
      new Set(
        itemList
          .filter((i) => Boolean(i.createdById))
          .map<number>((i) => i.createdById as number),
      ),
    );

    const createdByList = createdByIds.length
      ? await db.select().from(users).where(inArray(users.id, createdByIds))
      : [];
    const createdByById = Object.fromEntries(
      (await serialize(UserSerializer, createdByList, currentUser)).map(
        (data, index) => [createdByList[index].id, data],
      ),
    );
    if (createdByIds.length !== createdByList.length) {
      logError("Failed to fetch all createdBy relations for activity", {
        userId: currentUser.id,
      });
    }

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            createdBy: item.createdById
              ? createdByById[item.createdById]
              : undefined,
          },
        ];
      }),
    );
  },

  item: (item: Activity, attrs: Record<string, any>, currentUser: User) => {
    return {
      id: item.id,
      objectType: item.objectType,
      objectId: item.objectId,
      createdAt: item.createdAt,
      createdBy: attrs.createdBy,
    };
  },
};
