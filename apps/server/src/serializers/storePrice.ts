import { collectionBottles, tastings } from "@peated/server/db/schema";
import { loadCatalogTargetReadsWithParity } from "@peated/server/lib/catalogTargetReadParity";
import { loadCatalogTargetBatch } from "@peated/server/lib/catalogTargets";
import { getReservedCollection } from "@peated/server/lib/db";
import type { CatalogTargetV1 } from "@peated/server/schemas/catalogIdentity";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { ExternalSite, StorePrice, User } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import type {
  ExternalSiteSchema,
  PriceChangeSchema,
  StorePriceSchema,
} from "../schemas";
import type { Currency } from "../types";
import { ExternalSiteSerializer } from "./externalSite";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function priceIsValid(price: StorePrice) {
  return price.updatedAt > new Date(Date.now() - ONE_DAY_MS);
}

type StorePriceAttrs = {
  target: CatalogTargetV1 | null;
};

async function loadStorePriceTargetAttrs(
  itemList: StorePrice[],
): Promise<Record<number, StorePriceAttrs>> {
  const { targets } = await loadCatalogTargetReadsWithParity(
    itemList.map((item) => ({
      consumerTable: "store_price",
      rowLocator: { id: item.id },
      targetId: item.targetId,
      legacy: { bottleId: item.bottleId, releaseId: item.releaseId },
    })),
    {
      actor: null,
      permissions: { canReadCatalogIdentity: true },
      caller: "StorePriceSerializer",
      operation: "serialize",
    },
  );

  return Object.fromEntries(
    itemList.map((item, index) => {
      const target = targets[index];
      if (target === undefined) {
        throw new Error(
          `StorePriceSerializer target loader omitted store price ${item.id}.`,
        );
      }
      return [item.id, { target }];
    }),
  );
}

export const StorePriceSerializer = serializer({
  name: "storePrice",
  attrs: loadStorePriceTargetAttrs,
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
      target: attrs.target,
    };
  },
});

export const StorePriceWithSiteSerializer = serializer({
  name: "storePriceWithSite",
  attrs: async (
    itemList: (StorePrice & { externalSite: ExternalSite })[],
    currentUser?: User,
  ) => {
    const [targetAttrs, serializedSites] = await Promise.all([
      loadStorePriceTargetAttrs(itemList),
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
          target: targetAttrs[item.id].target,
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
      target: attrs.target,
    };
  },
});

export type PriceChange = {
  // CatalogTarget ID. Serializer keys require an `id` field.
  id: string | number;
  price: string | number;
  previousPrice: string | number;
  currency: Currency;
};

type PriceChangeAttrs = {
  target: CatalogTargetV1;
  isLibrary: boolean;
  hasTasted: boolean;
};

export const PriceChangeSerializer = serializer({
  name: "priceChange",
  attrs: async (itemList: PriceChange[], currentUser?: User) => {
    const targetIds = itemList.map((item) => Number(item.id));
    const targets = await loadCatalogTargetBatch(targetIds, {
      actor: null,
      permissions: { canReadCatalogIdentity: true },
    });
    const targetsById = Object.fromEntries(
      targetIds.map((targetId) => {
        const resolution = targets.get(targetId)!;
        if (!resolution.ok) throw resolution.error;
        return [targetId, resolution.target];
      }),
    );
    const library = currentUser
      ? await getReservedCollection(db, currentUser.id, "library")
      : null;
    const [libraryRows, tastingRows] =
      currentUser && targetIds.length
        ? await Promise.all([
            library
              ? db
                  .selectDistinct({ targetId: collectionBottles.targetId })
                  .from(collectionBottles)
                  .where(
                    and(
                      eq(collectionBottles.collectionId, library.id),
                      inArray(collectionBottles.targetId, targetIds),
                    ),
                  )
              : [],
            db
              .selectDistinct({ targetId: tastings.targetId })
              .from(tastings)
              .where(
                and(
                  eq(tastings.createdById, currentUser.id),
                  inArray(tastings.targetId, targetIds),
                ),
              ),
          ])
        : [[], []];
    const libraryTargetIds = new Set(
      libraryRows.flatMap(({ targetId }) =>
        targetId === null ? [] : [targetId],
      ),
    );
    const tastedTargetIds = new Set(
      tastingRows.flatMap(({ targetId }) =>
        targetId === null ? [] : [targetId],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          Number(item.id),
          {
            target: targetsById[Number(item.id)],
            isLibrary: libraryTargetIds.has(Number(item.id)),
            hasTasted: tastedTargetIds.has(Number(item.id)),
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
      target: attrs.target,
      isLibrary: attrs.isLibrary,
      hasTasted: attrs.hasTasted,
    };
  },
});
