import { and, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import {
  bottles,
  bottleTombstones,
  externalSites,
  type Review,
  type User,
} from "../db/schema";
import { type BottleSchema, type ReviewSchema } from "../schemas";
import { BottleSerializer } from "./bottle";
import { ExternalSiteSerializer } from "./externalSite";

type ReviewAttrs = {
  bottle: z.infer<typeof BottleSchema> | null;
  site: ReturnType<(typeof ExternalSiteSerializer)["item"]>;
};

export const ReviewSerializer = serializer({
  name: "review",
  attrs: async (
    itemList: Review[],
    currentUser?: User,
  ): Promise<Record<string, ReviewAttrs>> => {
    const bottleIds = Array.from(
      new Set(
        itemList.flatMap(({ bottleId }) =>
          bottleId === null ? [] : [bottleId],
        ),
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
        const bottle =
          item.bottleId === null
            ? null
            : (bottlesById.get(item.bottleId) ?? null);
        if (item.bottleId !== null && bottle === null) {
          throw new Error(
            `Review ${item.id} references missing Bottle ${item.bottleId}.`,
          );
        }
        return [
          item.id,
          {
            bottle,
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
