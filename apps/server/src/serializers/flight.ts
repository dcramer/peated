import { type z } from "zod";
import { serializer } from ".";
import type { Flight, User } from "../db/schema";
import { type FlightSchema } from "../schemas";

export const FlightSerializer = serializer({
  name: "flight",
  item: (
    item: Flight,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof FlightSchema> => {
    return {
      id: item.publicId,
      name: item.name,
      description: item.description,
      public: item.public,
      createdAt: item.createdAt.toISOString(),
    };
  },
});
