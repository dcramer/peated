import {
  bottles,
  bottleTombstones,
  collectionBottles,
  tastings,
} from "@peated/server/db/schema";
import { getReservedCollection } from "@peated/server/lib/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { ExternalSite, StorePrice, User } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import type {
  BottleSchema,
  ExternalSiteSchema,
  PriceChangeSchema,
  StorePriceSchema,
} from "../schemas";
import type { Currency } from "../types";
import { BottleSerializer } from "./bottle";
import { ExternalSiteSerializer } from "./externalSite";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function priceIsValid(price: StorePrice) {
  return price.updatedAt > new Date(Date.now() - ONE_DAY_MS);
}

type StorePriceAttrs = {
  bottle: z.infer<typeof BottleSchema> | null;
};

async function loadStorePriceBottleAttrs(
  itemList: StorePrice[],
  currentUser?: User,
): Promise<Record<number, StorePriceAttrs>> {
  const bottleIds = Array.from(
    new Set(
      itemList.flatMap(({ bottleId }) => (bottleId === null ? [] : [bottleId])),
    ),
  );
  const bottleList = bottleIds.length
    ? await db
        .select()
        .from(bottles)
        .where(
          and(
            inArray(bottles.id, bottleIds),
            sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
          ),
        )
    : [];
  const serializedBottles = await serialize(
    BottleSerializer,
    bottleList,
    currentUser,
  );
  const bottlesById = new Map(
    serializedBottles.map((bottle) => [bottle.id, bottle]),
  );

  return Object.fromEntries(
    itemList.map((item) => {
      const bottle =
        item.bottleId === null
          ? null
          : (bottlesById.get(item.bottleId) ?? null);
      if (item.bottleId !== null && bottle === null) {
        throw new Error(
          `Store price ${item.id} references missing Bottle ${item.bottleId}.`,
        );
      }
      return [item.id, { bottle }];
    }),
  );
}

export const StorePriceSerializer = serializer({
  name: "storePrice",
  attrs: loadStorePriceBottleAttrs,
  item: (
    item: StorePrice,
    attrs: StorePriceAttrs,
    currentUser?: User,
  ): z.infer<typeof StorePriceSchema> => {
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      volume: item.volume,
      currency: item.currency,
      url: item.url,
      isValid: priceIsValid(item),
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      updatedAt: item.updatedAt.toISOString(),
      bottle: attrs.bottle,
    };
  },
});

export const StorePriceWithSiteSerializer = serializer({
  name: "storePriceWithSite",
  attrs: async (
    itemList: (StorePrice & { externalSite: ExternalSite })[],
    currentUser?: User,
  ) => {
    const [bottleAttrs, serializedSites] = await Promise.all([
      loadStorePriceBottleAttrs(itemList, currentUser),
      serialize(
        ExternalSiteSerializer,
        itemList.map((r) => r.externalSite),
        currentUser,
      ),
    ]);
    const sitesByRef = Object.fromEntries(
      serializedSites.map((data, index) => [itemList[index].id, data]),
    );

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          site: sitesByRef[item.id] || null,
          bottle: bottleAttrs[item.id].bottle,
        },
      ]),
    );
  },

  item: (
    item: StorePrice & { externalSite: ExternalSite },
    attrs: StorePriceAttrs & {
      site: z.infer<typeof ExternalSiteSchema>;
    },
    currentUser?: User,
  ): z.infer<typeof StorePriceSchema> & {
    site: z.infer<typeof ExternalSiteSchema>;
  } => {
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
      isValid: priceIsValid(item),
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      site: attrs.site,
      updatedAt: item.updatedAt.toISOString(),
      bottle: attrs.bottle,
    };
  },
});

export type PriceChange = {
  // Bottle ID. Serializer keys require an `id` field.
  id: string | number;
  price: string | number;
  previousPrice: string | number;
  currency: Currency;
};

type PriceChangeAttrs = {
  bottle: z.infer<typeof BottleSchema>;
  isLibrary: boolean;
  hasTasted: boolean;
};

export const PriceChangeSerializer = serializer({
  name: "priceChange",
  attrs: async (itemList: PriceChange[], currentUser?: User) => {
    const bottleIds = itemList.map((item) => Number(item.id));
    const bottleList = bottleIds.length
      ? await db
          .select()
          .from(bottles)
          .where(
            and(
              inArray(bottles.id, bottleIds),
              sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
            ),
          )
      : [];
    const serializedBottles = await serialize(
      BottleSerializer,
      bottleList,
      currentUser,
    );
    const bottlesById = new Map(
      serializedBottles.map((bottle) => [bottle.id, bottle]),
    );
    const library = currentUser
      ? await getReservedCollection(db, currentUser.id, "library")
      : null;
    const [libraryRows, tastingRows] =
      currentUser && bottleIds.length
        ? await Promise.all([
            library
              ? db
                  .selectDistinct({ bottleId: collectionBottles.bottleId })
                  .from(collectionBottles)
                  .where(
                    and(
                      eq(collectionBottles.collectionId, library.id),
                      inArray(collectionBottles.bottleId, bottleIds),
                    ),
                  )
              : [],
            db
              .selectDistinct({ bottleId: tastings.bottleId })
              .from(tastings)
              .where(
                and(
                  eq(tastings.createdById, currentUser.id),
                  inArray(tastings.bottleId, bottleIds),
                ),
              ),
          ])
        : [[], []];
    const libraryBottleIds = new Set(
      libraryRows.flatMap(({ bottleId }) =>
        bottleId === null ? [] : [bottleId],
      ),
    );
    const tastedBottleIds = new Set(
      tastingRows.flatMap(({ bottleId }) =>
        bottleId === null ? [] : [bottleId],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        const bottleId = Number(item.id);
        const bottle = bottlesById.get(bottleId);
        if (!bottle) {
          throw new Error(
            `Price change references missing Bottle ${bottleId}.`,
          );
        }
        return [
          bottleId,
          {
            bottle,
            isLibrary: libraryBottleIds.has(bottleId),
            hasTasted: tastedBottleIds.has(bottleId),
          },
        ];
      }),
    );
  },

  item: (
    item: PriceChange,
    attrs: PriceChangeAttrs,
    currentUser?: User,
  ): z.infer<typeof PriceChangeSchema> => {
    return {
      id: Number(item.id),
      price: Number(item.price),
      currency: item.currency,
      previousPrice: Number(item.previousPrice),
      bottle: attrs.bottle,
      isLibrary: attrs.isLibrary,
      hasTasted: attrs.hasTasted,
    };
  },
});
