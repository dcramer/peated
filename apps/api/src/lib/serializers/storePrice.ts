import type {
  Bottle,
  Store,
  StorePrice,
  StorePriceHistory,
  User,
} from "../../db/schema";

import { serialize, type Serializer } from ".";
import { notEmpty } from "../filter";
import { BottleSerializer } from "./bottle";
import { StoreSerializer } from "./store";

export const StorePriceSerializer: Serializer<StorePrice> = {
  item: (item: StorePrice, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      bottleId: item.bottleId,
      name: item.name,
      price: item.price,
      volume: item.volume,
      url: item.url,
      updatedAt: attrs.updatedAt,
    };
  },
};

export const StorePriceWithStoreSerializer: Serializer<
  StorePrice & { store: Store }
> = {
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
};

export const PriceChangeSerializer: Serializer<StorePrice & { store: Store }> =
  {
    attrs: async (
      itemList: (StorePrice & { store: Store; bottle: Bottle })[],
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
      const bottlesByRef = Object.fromEntries(
        (
          await serialize(
            BottleSerializer,
            itemList.map((r) => r.bottle).filter(notEmpty),
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
              bottle: bottlesByRef[item.id] || null,
            },
          ];
        }),
      );
    },

    item: (
      item: StorePrice & {
        store: Store;
        previous?: StorePriceHistory;
        bottle: Bottle;
      },
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
        bottle: attrs.bottle,
        previous: item.previous
          ? {
              price: item.previous.price,
              date: item.previous.date,
            }
          : null,
        updatedAt: item.updatedAt,
      };
    },
  };
