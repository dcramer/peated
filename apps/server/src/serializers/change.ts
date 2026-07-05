import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Change, User } from "../db/schema";
import { actors } from "../db/schema";
import { type ChangeSchema } from "../schemas";
import { ActorSerializer } from "./actor";

type ChangeAttrs = {
  createdByActor: ReturnType<(typeof ActorSerializer)["item"]>;
};

export const ChangeSerializer = serializer({
  name: "change",
  attrs: async (
    itemList: Change[],
    currentUser: User | null,
  ): Promise<Record<number, ChangeAttrs>> => {
    const actorIds = Array.from(new Set(itemList.map((i) => i.actorId)));

    const actorList = actorIds.length
      ? await db.select().from(actors).where(inArray(actors.id, actorIds))
      : [];
    const actorById = Object.fromEntries(
      (await serialize(ActorSerializer, actorList, currentUser)).map(
        (data, index) => [actorList[index].id, data],
      ),
    );
    if (actorIds.length !== actorList.length) {
      throw new Error("Failed to fetch all actor relations for changes");
    }

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
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
      createdByActor: attrs.createdByActor,
      data: item.data,
    };
  },
});
