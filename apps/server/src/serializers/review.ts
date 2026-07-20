import { inArray } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { externalSites, type Review, type User } from "../db/schema";
import { loadCatalogTargetReadsWithParity } from "../lib/catalogTargetReadParity";
import { type ReviewSchema } from "../schemas";
import type { CatalogTargetV1 } from "../schemas/catalogIdentity";
import { ExternalSiteSerializer } from "./externalSite";

type ReviewAttrs = {
  target: CatalogTargetV1 | null;
  site: ReturnType<(typeof ExternalSiteSerializer)["item"]>;
};

export const ReviewSerializer = serializer({
  name: "review",
  attrs: async (
    itemList: Review[],
    currentUser?: User,
  ): Promise<Record<string, ReviewAttrs>> => {
    const { targets } = await loadCatalogTargetReadsWithParity(
      itemList.map((item) => ({
        consumerTable: "review",
        rowLocator: { id: item.id },
        targetId: item.targetId,
        legacy: { bottleId: item.bottleId, releaseId: item.releaseId },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        caller: "ReviewSerializer",
        operation: "serialize",
      },
    );
    const targetByReviewId = Object.fromEntries(
      itemList.map((item, index) => {
        const target = targets[index];
        if (target === undefined) {
          throw new Error(
            `ReviewSerializer target loader omitted review ${item.id}.`,
          );
        }
        return [item.id, target];
      }),
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
            target: targetByReviewId[item.id],
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
      target: attrs.target,
      site: attrs.site,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
