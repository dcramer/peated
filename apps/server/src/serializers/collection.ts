import type { z } from "zod";
import { serializer } from ".";
import type { Collection, User } from "../db/schema";
import type { CollectionSchema } from "../schemas";

export const CollectionSerializer = serializer({
  name: "collection",
  item: (
    item: Collection,
    attrs: Record<string, any>,
    currentUser?: User
  ): z.infer<typeof CollectionSchema> => {
    return {
      id: item.id,
      name: item.name,
      totalBottles: item.totalBottles,
      createdAt: item.createdAt.toISOString(),
    };
  },
});
