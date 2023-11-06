import type { Serializer } from ".";
import type { Flight, User } from "../db/schema";

export const FlightSerializer: Serializer<Flight> = {
  item: (item: Flight, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.publicId,
      name: item.name,
      description: item.description,
      public: item.public,
      createdAt: item.createdAt,
    };
  },
};
