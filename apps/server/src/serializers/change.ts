import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Change, User } from "../db/schema";
import { users } from "../db/schema";
import { logError } from "../lib/log";
import { type ChangeSchema } from "../schemas";
import { UserSerializer } from "./user";

type ChangeAttrs = {
  createdBy: ReturnType<(typeof UserSerializer)["item"]> | null;
};

export const ChangeSerializer = serializer({
  attrs: async (
    itemList: Change[],
    currentUser: User,
  ): Promise<Record<number, ChangeAttrs>> => {
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
      logError("Failed to fetch all createdBy relations for changes");
    }

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            createdBy: item.createdById
              ? createdByById[item.createdById]
              : null,
          },
        ];
      }),
    );
  },

  item: (
    item: Change,
    attrs: ChangeAttrs,
    currentUser: User,
  ): z.infer<typeof ChangeSchema> => {
    return {
      id: item.id,
      objectType: item.objectType,
      objectId: item.objectId,
      displayName: item.displayName,
      type: item.type,
      createdAt: item.createdAt.toISOString(),
      createdBy: attrs.createdBy,
      data: item.data,
    };
  },
});
