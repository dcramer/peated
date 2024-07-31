import { type z } from "zod";
import { serializer } from ".";
import type { Event, User } from "../db/schema";
import { type EventSchema } from "../schemas";

export const EventSerializer = serializer({
  item: (
    item: Event,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof EventSchema> => {
    return {
      id: item.id,
      name: item.name,
      dateStart: item.dateStart,
      dateEnd: item.dateEnd,
      repeats: item.repeats,
      description: item.description,
      website: item.website,
    };
  },
});
