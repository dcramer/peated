import { serializer } from ".";
import type { Collection, User } from "../db/schema";

export const CollectionSerializer = serializer({
  item: (item: Collection, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      totalBottles: item.totalBottles,
      createdAt: item.createdAt,
    };
  },
});
