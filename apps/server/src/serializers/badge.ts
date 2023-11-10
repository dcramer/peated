import type { Badge, User } from "../db/schema";

import { serializer } from ".";

export const BadgeSerializer = serializer({
  item: (item: Badge, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      config: item.config,
    };
  },
});
