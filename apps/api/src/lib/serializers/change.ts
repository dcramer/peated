import type { Change, User } from "@peated/shared/db/schema";
import { users } from "@peated/shared/db/schema";

import { db } from "@peated/shared/db";
import { inArray } from "drizzle-orm";
import type { Serializer } from ".";
import { serialize } from ".";
import { logError } from "../log";
import { UserSerializer } from "./user";

export const ChangeSerializer: Serializer<Change> = {
  attrs: async (itemList: Change[], currentUser: User) => {
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
      logError("Failed to fetch all createdBy relations for changes", {
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

  item: (item: Change, attrs: Record<string, any>, currentUser: User) => {
    return {
      id: item.id,
      objectType: item.objectType,
      objectId: item.objectId,
      displayName: item.displayName,
      type: item.type,
      createdAt: item.createdAt,
      createdBy: attrs.createdBy,
      data: item.data,
    };
  },
};
