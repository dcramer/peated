import { inArray } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { BottleSeries, User } from "../db/schema";
import { entities } from "../db/schema";
import { notEmpty } from "../lib/filter";
import type { BottleSeriesSchema } from "../schemas/bottleSeries";
import { EntitySerializer } from "./entity";

type Attrs = {
  brand: ReturnType<(typeof EntitySerializer)["item"]>;
};

export const BottleSeriesSerializer = serializer({
  name: "bottleSeries",
  attrs: async (
    itemList: BottleSeries[],
    currentUser?: User
  ): Promise<Record<number, Attrs>> => {
    const brandIds = Array.from(new Set(itemList.map((i) => i.brandId))).filter(
      notEmpty
    );

    const brandList = await db
      .select()
      .from(entities)
      .where(inArray(entities.id, brandIds));

    const entitiesById = Object.fromEntries(
      (await serialize(EntitySerializer, brandList, currentUser)).map(
        (data, index) => [brandList[index].id, data]
      )
    );

    const results: Record<number, Attrs> = {};
    itemList.forEach((item) => {
      const brand = entitiesById[item.brandId];
      if (!brand) return;

      results[item.id] = {
        brand,
      };
    });

    return results;
  },

  item(
    item: BottleSeries,
    attrs: Attrs,
    currentUser?: User
  ): z.infer<typeof BottleSeriesSchema> {
    return {
      id: item.id,
      name: item.name,
      fullName: item.fullName,
      brand: attrs.brand,
      description: item.description,
      numReleases: item.numReleases,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
