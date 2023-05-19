import { inArray } from "drizzle-orm";
import { Result, Serializer, serialize } from ".";
import { db } from "../../db";
import { Bottle, User, bottlesToDistillers, entities } from "../../db/schema";
import { EntitySerializer } from "./entity";

export const BottleSerializer: Serializer<Bottle> = {
  attrs: async (itemList: Bottle[], currentUser?: User) => {
    const itemIds = itemList.map((t) => t.id);

    const distillerList = await db
      .select()
      .from(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, itemIds));

    const entityIds = Array.from(
      new Set([
        ...itemList.map((i) => i.brandId),
        ...distillerList.map((d) => d.distillerId),
      ]),
    );

    const entityList = await db
      .select()
      .from(entities)
      .where(inArray(entities.id, entityIds));
    const entitiesById = Object.fromEntries(
      (await serialize(EntitySerializer, entityList, currentUser)).map(
        (data, index) => [entityList[index].id, data],
      ),
    );

    const distillersByBottleId: {
      [bottleId: number]: Result;
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
          },
        ];
      }),
    );
  },

  item: (item: Bottle, attrs: Record<string, any>, currentUser?: User) => {
    return {
      id: item.id,
      name: item.name,
      statedAge: item.statedAge,
      category: item.category,
      brand: attrs.brand,
      distillers: attrs.distillers,
    };
  },
};
