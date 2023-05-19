import { Entity, User } from "../../db/schema";

import { Serializer } from ".";

export const EntitySerializer: Serializer<Entity> = {
  item: (item: Entity, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      country: item.country,
      region: item.region,
      type: item.type,
      createdAt: item.createdAt,

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
};
