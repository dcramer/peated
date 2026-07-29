import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import {
  bottles,
  type CollectionBottle,
  tastings,
  type User,
} from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import { type CollectionBottleSchema } from "../schemas";
import type { BottleSchema } from "../schemas/bottles";
import { BottleSerializer } from "./bottle";

type CollectionBottleAttrs = {
  bottle: z.infer<typeof BottleSchema>;
  hasTasted: boolean;
};

export const CollectionBottleSerializer = serializer({
  name: "collectionBottle",
  attrs: async (
    itemList: CollectionBottle[],
    currentUser?: User,
  ): Promise<Record<number, CollectionBottleAttrs>> => {
    const bottleIds = [...new Set(itemList.map(({ bottleId }) => bottleId))];
    const bottleRows = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, bottleIds));
    const serializedBottles = await serialize(
      BottleSerializer,
      bottleRows,
      currentUser,
    );
    const bottleById = new Map(
      serializedBottles.map((bottle) => [bottle.id, bottle]),
    );
    const tastedBottleIds = new Set(
      currentUser && bottleIds.length
        ? (
            await db
              .selectDistinct({ bottleId: tastings.bottleId })
              .from(tastings)
              .where(
                and(
                  eq(tastings.createdById, currentUser.id),
                  inArray(tastings.bottleId, bottleIds),
                ),
              )
          ).map(({ bottleId }) => bottleId)
        : [],
    );
    return Object.fromEntries(
      itemList.map((item) => {
        const bottle = bottleById.get(item.bottleId);
        if (!bottle) {
          throw new Error(
            `collection membership ${item.id} references missing Bottle ${item.bottleId}`,
          );
        }
        return [
          item.id,
          {
            bottle,
            hasTasted: tastedBottleIds.has(bottle.id),
          },
        ];
      }),
    );
  },
  item: (
    item: CollectionBottle,
    attrs: CollectionBottleAttrs,
    _currentUser?: User,
  ): z.infer<typeof CollectionBottleSchema> => {
    return {
      id: item.id,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      status: item.status,
      bottle: attrs.bottle,
      hasTasted: attrs.hasTasted,
    };
  },
});
