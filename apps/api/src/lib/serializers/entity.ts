import type { Entity, User } from "../../db/schema";

import type { Serializer } from ".";

export const EntitySerializer: Serializer<Entity> = {
  item: (
    item: Entity & {
      location: string;
    },
    attrs: Record<string, any>,
    currentUser?: User,
  ) => {
    return {
      id: item.id,
      name: item.name,
      country: item.country,
      region: item.region,
      type: item.type,
      location: item.location ? JSON.parse(item.location).coordinates : null,
      createdAt: item.createdAt,

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
};
