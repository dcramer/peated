import type { Bottle, CollectionBottle, User } from "../../db/schema";

import type { Serializer } from ".";
import { serialize } from ".";
import { BottleSerializer } from "./bottle";

export const CollectionBottleSerializer: Serializer<
  CollectionBottle & {
    bottle: Bottle;
  }
> = {
  attrs: async (
    itemList: (CollectionBottle & {
      bottle: Bottle;
    })[],
    currentUser?: User,
  ) => {
    const bottleList = itemList.map((i) => i.bottle);
    const bottlesById = Object.fromEntries(
      (await serialize(BottleSerializer, bottleList, currentUser)).map(
        (data, index) => [bottleList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            bottle: bottlesById[item.bottleId],
          },
        ];
      }),
    );
  },
  item: (
    item: CollectionBottle & {
      bottle: Bottle;
    },
    attrs: Record<string, any>,
    currentUser?: User,
  ) => {
    return {
      id: item.id,
      series: item.series,
      vintageYear: item.vintageYear,
      barrel: item.barrel,
      bottle: attrs.bottle,
    };
  },
};
