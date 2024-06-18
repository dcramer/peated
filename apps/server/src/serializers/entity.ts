import { type z } from "zod";
import { serializer } from ".";
import { type SerializedPoint, type UnserializedPoint } from "../db/columns";
import type { Entity, User } from "../db/schema";
import { type EntitySchema } from "../schemas";

export const EntitySerializer = serializer({
  item: (
    item: Entity & {
      location: SerializedPoint;
    },
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof EntitySchema> => {
    return {
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      type: item.type,
      description: item.description,
      yearEstablished: item.yearEstablished,
      website: item.website,
      country: item.country,
      region: item.region,
      address: item.address,
      location: item.location
        ? ((JSON.parse(item.location) as UnserializedPoint).coordinates as [
            number,
            number,
          ])
        : null,
      createdAt: item.createdAt.toISOString(),

      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
    };
  },
});
