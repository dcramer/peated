import { getTableColumns, inArray, sql } from "drizzle-orm";
import type { Serializer } from ".";
import { serialize } from ".";
import { db } from "../../db";
import type { Bottle, User } from "../../db/schema";
import { bottlesToDistillers, entities } from "../../db/schema";
import { notEmpty } from "../filter";
import { EntitySerializer } from "./entity";

export const BottleSerializer: Serializer<Bottle> = {
  attrs: async (itemList: Bottle[], currentUser?: User) => {
    const itemIds = itemList.map((t) => t.id);

    const distillerList = await db
      .select()
      .from(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, itemIds));

    const entityIds = Array.from(
      new Set(
        [
          ...itemList.map((i) => i.brandId),
          ...itemList.map((i) => i.bottlerId),
          ...distillerList.map((d) => d.distillerId),
        ].filter(notEmpty),
      ),
    );

    const entityList = await db
      .select({
        ...getTableColumns(entities),
        location: sql`ST_AsGeoJSON(${entities.location}) as location`,
      })
      .from(entities)
      .where(inArray(entities.id, entityIds));
    const entitiesById = Object.fromEntries(
      (await serialize(EntitySerializer, entityList, currentUser)).map(
        (data, index) => [entityList[index].id, data],
      ),
    );

    const distillersByBottleId: {
      [bottleId: number]: ReturnType<(typeof EntitySerializer)["item"]>;
    } = {};
    distillerList.forEach((d) => {
      if (!distillersByBottleId[d.bottleId])
        distillersByBottleId[d.bottleId] = [entitiesById[d.distillerId]];
      else distillersByBottleId[d.bottleId].push(entitiesById[d.distillerId]);
    });

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            brand: entitiesById[item.brandId],
            distillers: distillersByBottleId[item.id] || [],
            bottler: item.bottlerId ? entitiesById[item.bottlerId] : null,
          },
        ];
      }),
    );
  },

  item: (item: Bottle, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      series: item.series,
      statedAge: item.statedAge,
      category: item.category,
      brand: attrs.brand,
      distillers: attrs.distillers,
      bottler: attrs.bottler,
    };
  },
};
