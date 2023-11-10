import { type z } from "zod";
import { serialize, serializer } from ".";
import type { Bottle, CollectionBottle, User } from "../db/schema";
import { type CollectionBottleSchema } from "../schemas";
import { BottleSerializer } from "./bottle";

type CollectionBottleAttrs = {
  bottle: ReturnType<(typeof BottleSerializer)["item"]>;
};

export const CollectionBottleSerializer = serializer({
  attrs: async (
    itemList: (CollectionBottle & {
      bottle: Bottle;
    })[],
    currentUser?: User,
  ): Promise<Record<number, CollectionBottleAttrs>> => {
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
    attrs: CollectionBottleAttrs,
    currentUser?: User,
  ): z.infer<typeof CollectionBottleSchema> => {
    return {
      id: item.id,
      bottle: attrs.bottle,
    };
  },
});
