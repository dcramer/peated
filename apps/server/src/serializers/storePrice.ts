import type { z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Store, StorePrice, User } from "../db/schema";
import type { BottlePriceChangeSchema } from "../schemas";
import { BottleSerializer } from "./bottle";
import { StoreSerializer } from "./store";

export const StorePriceSerializer = serializer({
  item: (item: StorePrice, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      volume: item.volume,
      url: item.url,
      updatedAt: attrs.updatedAt,
    };
  },
});

export const StorePriceWithStoreSerializer = serializer({
  attrs: async (
    itemList: (StorePrice & { store: Store })[],
    currentUser?: User,
  ) => {
    const storesByRef = Object.fromEntries(
      (
        await serialize(
          StoreSerializer,
          itemList.map((r) => r.store),
          currentUser,
        )
      ).map((data, index) => [itemList[index].id, data]),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            store: storesByRef[item.id] || null,
          },
        ];
      }),
    );
  },

  item: (
    item: StorePrice & { store: Store },
    attrs: Record<string, any>,
    currentUser?: User,
  ) => {
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      volume: item.volume,
      url: item.url,
      store: attrs.store,
      updatedAt: item.updatedAt,
    };
  },
});

export type BottlePriceChange = {
  // bottle ID
  id: number;
  price: number;
  previousPrice: number;
  bottleId: number;
};

export const BottlePriceChangeSerializer = serializer({
  attrs: async (itemList: BottlePriceChange[], currentUser?: User) => {
    const bottleList = await db.query.bottles.findMany({
      where: (bottles, { inArray }) =>
        inArray(
          bottles.id,
          itemList.map((b) => b.id),
        ),
    });
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
            bottle: bottlesById[item.id],
          },
        ];
      }),
    );
  },

  item: (
    item: BottlePriceChange,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof BottlePriceChangeSchema> => {
    return {
      id: item.id,
      price: item.price,
      previousPrice: item.previousPrice,
      bottle: attrs.bottle,
    };
  },
});
