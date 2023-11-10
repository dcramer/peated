import { serializer } from ".";
import type { Store, User } from "../db/schema";

export const StoreSerializer = serializer({
  item: (item: Store, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      country: item.country,
      lastRunAt: item.lastRunAt,
    };
  },
});
