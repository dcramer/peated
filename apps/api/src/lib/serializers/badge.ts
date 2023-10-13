import type { Badge, User } from "@peated/shared/db/schema";

import type { Serializer } from ".";

export const BadgeSerializer: Serializer<Badge> = {
  item: (item: Badge, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      config: item.config,
    };
  },
};
