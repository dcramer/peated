import { Collection, User } from "../../db/schema";

import { Serializer } from ".";

export const CollectionSerializer: Serializer<Collection> = {
  item: (item: Collection, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
    };
  },
};
