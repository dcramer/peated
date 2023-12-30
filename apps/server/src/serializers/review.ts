import { serializer } from ".";
import type { Review, User } from "../db/schema";

export const ReviewSerializer = serializer({
  item: (item: Review, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      rating: item.rating,
      url: item.url,
    };
  },
});
