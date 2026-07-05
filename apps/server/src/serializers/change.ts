import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Change, User } from "../db/schema";
import { actors, users } from "../db/schema";
import { logError } from "../lib/log";
import { type ChangeSchema } from "../schemas";
import { ActorSerializer } from "./actor";
import { UserSerializer } from "./user";

type ChangeAttrs = {
  createdBy: ReturnType<(typeof UserSerializer)["item"]> | null;
  createdByActor: ReturnType<(typeof ActorSerializer)["item"]>;
};

export const ChangeSerializer = serializer({
  name: "change",
  attrs: async (
    itemList: Change[],
    currentUser: User | null,
  ): Promise<Record<number, ChangeAttrs>> => {
    const actorIds = Array.from(new Set(itemList.map((i) => i.actorId)));
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
    const actorList = actorIds.length
      ? await db.select().from(actors).where(inArray(actors.id, actorIds))
      : [];
    const createdByById = Object.fromEntries(
      (await serialize(UserSerializer, createdByList, currentUser)).map(
        (data, index) => [createdByList[index].id, data],
      ),
    );
    const actorById = Object.fromEntries(
      (await serialize(ActorSerializer, actorList, currentUser)).map(
        (data, index) => [actorList[index].id, data],
      ),
    );
    if (createdByIds.length !== createdByList.length) {
      logError("Failed to fetch all createdBy relations for changes");
    }
    if (actorIds.length !== actorList.length) {
      throw new Error("Failed to fetch all actor relations for changes");
    }

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            createdBy: item.createdById
              ? createdByById[item.createdById]
              : null,
            createdByActor: actorById[item.actorId],
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
      createdByActor: attrs.createdByActor,
      data: item.data,
    };
  },
});
