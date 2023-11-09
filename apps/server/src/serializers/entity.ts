import { type z } from "zod";
import { serializer } from ".";
import type { Entity, User } from "../db/schema";
import { type EntitySchema } from "../schemas";

export const EntitySerializer = serializer({
  item: (
    item: Entity & {
      location: string;
    },
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof EntitySchema> => {
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
      createdAt: item.createdAt.toISOString(),

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
});
