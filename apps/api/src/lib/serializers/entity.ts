import type { Entity, User } from "@peated/shared/db/schema";

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
      description: item.description,
      yearEstablished: item.yearEstablished,
      website: item.website,
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
