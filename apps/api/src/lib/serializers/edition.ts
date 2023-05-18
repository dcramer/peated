import { Edition, User } from "../../db/schema";

import { Serializer } from ".";

export const EditionSerializer: Serializer<Edition> = {
  item: (item: Edition, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: `${item.id}`,
      name: item.name,
      barrel: item.barrel,
      vintageYear: item.vintageYear,
      createdAt: item.createdAt,
    };
  },
};
