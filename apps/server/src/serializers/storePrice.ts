import type { z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { ExternalSite, StorePrice, User } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import type { BottlePriceChangeSchema, StorePriceSchema } from "../schemas";
import type { Currency } from "../types";
import { BottleSerializer } from "./bottle";
import { ExternalSiteSerializer } from "./externalSite";

export const StorePriceSerializer = serializer({
  item: (
    item: StorePrice,
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof StorePriceSchema> => {
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      volume: item.volume,
      currency: item.currency,
      url: item.url,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});

export const StorePriceWithSiteSerializer = serializer({
  attrs: async (
    itemList: (StorePrice & { externalSite: ExternalSite })[],
    currentUser?: User,
  ) => {
    const sitesByRef = Object.fromEntries(
      (
        await serialize(
          ExternalSiteSerializer,
          itemList.map((r) => r.externalSite),
          currentUser,
        )
      ).map((data, index) => [itemList[index].id, data]),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            site: sitesByRef[item.id] || null,
          },
        ];
      }),
    );
  },

  item: (
    item: StorePrice & { externalSite: ExternalSite },
    attrs: Record<string, any>,
    currentUser?: User,
  ): z.infer<typeof StorePriceSchema> => {
    // add a referrer marker to the URL in case upstream sites want to track
    // where the traffic is coming from
    const affUrl =
      item.url.indexOf("?") !== -1
        ? `${item.url}&utm=peated`
        : `${item.url}?utm=peated`;

    return {
      id: item.id,
      name: item.name,
      price: item.price,
      volume: item.volume,
      currency: item.currency,
      url: affUrl,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      site: attrs.site,
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});

export type BottlePriceChange = {
  // bottle ID
  id: number;
  price: number;
  previousPrice: number;
  currency: Currency;
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
      currency: item.currency,
      previousPrice: item.previousPrice,
      bottle: attrs.bottle,
    };
  },
});
