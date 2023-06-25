import type { Store, User } from "../../db/schema";

import type { Serializer } from ".";

export const BadgeSerializer: Serializer<Store> = {
  item: (item: Store, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      config: item.config,
    };
  },
};
