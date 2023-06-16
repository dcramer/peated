import type { StorePrice, User } from "../../db/schema";

import type { Serializer } from ".";

export const StorePriceSerializer: Serializer<StorePrice> = {
  item: (item: StorePrice, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      bottleId: item.bottleId,
      name: item.name,
      price: item.price,
      url: item.url,
    };
  },
};
