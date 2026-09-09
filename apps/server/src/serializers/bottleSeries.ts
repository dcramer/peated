import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleImages, type BottleSeries } from "@peated/server/db/schema";
import { absoluteUrl } from "@peated/server/lib/urls";
import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serializer } from ".";
import { formatPeatedId } from "../lib/peatedId";
import {
  type BottleSeriesSchema,
  type BottleSeriesWithImageSchema,
} from "../schemas/bottleSeries";

interface BottleSeriesAttrs {
  imageUrl: string | null;
}

export const BottleSeriesSerializer = serializer({
  name: "bottleSeries",
  item(item: BottleSeries): z.infer<typeof BottleSeriesSchema> {
    return {
      id: item.id,
      peatedId: formatPeatedId("series", item.id),
      name: item.name,
      fullName: item.fullName,
      description: item.description,
      numReleases: item.numReleases,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});

export const BottleSeriesWithImageSerializer = serializer({
  name: "bottleSeriesWithImage",
  attrs: async (itemList: BottleSeries[]) => {
    const representativeBottleIds = Array.from(
      new Set(
        itemList.flatMap(({ representativeBottleId }) =>
          representativeBottleId === null ? [] : [representativeBottleId],
        ),
      ),
    );
    const images = representativeBottleIds.length
      ? await db
          .select({
            bottleId: bottleImages.bottleId,
            imageUrl: bottleImages.imageUrl,
          })
          .from(bottleImages)
          .where(
            and(
              inArray(bottleImages.bottleId, representativeBottleIds),
              eq(bottleImages.isPrimary, true),
            ),
          )
      : [];
    const imageByBottleId = new Map(
      images.map(({ bottleId, imageUrl }) => [bottleId, imageUrl] as const),
    );

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          imageUrl:
            item.representativeBottleId === null
              ? null
              : (imageByBottleId.get(item.representativeBottleId) ?? null),
        },
      ]),
    );
  },
  item(
    item: BottleSeries,
    attrs: BottleSeriesAttrs,
  ): z.infer<typeof BottleSeriesWithImageSchema> {
    return {
      ...BottleSeriesSerializer.item(item, {}),
      representativeBottleId: item.representativeBottleId,
      imageUrl: attrs.imageUrl
        ? absoluteUrl(config.API_SERVER, attrs.imageUrl)
        : null,
    };
  },
});
