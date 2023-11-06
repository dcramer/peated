import { serializer } from ".";
import type { Flight, User } from "../db/schema";

export const FlightSerializer = serializer({
  item: (item: Flight, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.publicId,
      name: item.name,
      description: item.description,
      public: item.public,
      createdAt: item.createdAt,
    };
  },
});
