import { inArray } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import {
  bottles,
  externalSites,
  type Bottle,
  type Review,
  type User,
} from "../db/schema";
import { notEmpty } from "../lib/filter";
import { type ReviewSchema } from "../schemas";
import { BottleSerializer } from "./bottle";
import { ExternalSiteSerializer } from "./externalSite";

type ReviewAttrs = {
  bottle: ReturnType<(typeof BottleSerializer)["item"]> | null;
  site: ReturnType<(typeof ExternalSiteSerializer)["item"]>;
};

export const ReviewSerializer = serializer({
  name: "review",
  attrs: async (
    itemList: (Review & { bottle: Bottle })[],
    currentUser?: User,
  ): Promise<Record<string, ReviewAttrs>> => {
    const bottleIds = Array.from(
      new Set(itemList.map((i) => i.bottleId).filter(notEmpty)),
    );
    const bottleList = bottleIds.length
      ? await db.select().from(bottles).where(inArray(bottles.id, bottleIds))
      : [];
    const bottlesByRef = Object.fromEntries(
      (await serialize(BottleSerializer, bottleList, currentUser)).map(
        (data, index) => [bottleList[index].id, data],
      ),
    );

    const siteIds = Array.from(new Set(itemList.map((i) => i.externalSiteId)));
    const siteList = siteIds.length
      ? await db
          .select()
          .from(externalSites)
          .where(inArray(externalSites.id, siteIds))
      : [];
    const sitesByRef = Object.fromEntries(
      (await serialize(ExternalSiteSerializer, siteList, currentUser)).map(
        (data, index) => [siteList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            bottle: item.bottleId ? bottlesByRef[item.bottleId] : null,
            site: sitesByRef[item.externalSiteId],
          },
        ];
      }),
    );
  },

  item: (
    item: Review,
    attrs: ReviewAttrs,
    currentUser?: User,
  ): z.infer<typeof ReviewSchema> => {
    return {
      id: item.id,
      name: item.name,
      rating: item.rating,
      url: item.url,
      bottle: attrs.bottle,
      site: attrs.site,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
