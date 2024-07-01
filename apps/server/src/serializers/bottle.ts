import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import { type SerializedPoint } from "../db/columns/geography";
import type { Bottle, Flight, User } from "../db/schema";
import {
  bottlesToDistillers,
  collectionBottles,
  collections,
  entities,
  tastings,
} from "../db/schema";
import { notEmpty } from "../lib/filter";
import { type BottleSchema } from "../schemas";
import { EntitySerializer } from "./entity";

type Attrs = {
  isFavorite: boolean;
  hasTasted: boolean;
  brand: ReturnType<(typeof EntitySerializer)["item"]>;
  distillers: ReturnType<(typeof EntitySerializer)["item"]>[];
  bottler: ReturnType<(typeof EntitySerializer)["item"]> | null;
};

type Context =
  | {
      flight?: Flight | null;
    }
  | undefined;

export const BottleSerializer = serializer({
  attrs: async (
    itemList: Bottle[],
    currentUser?: User,
    context?: Context,
  ): Promise<Record<number, Attrs>> => {
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
        location: sql<SerializedPoint>`ST_AsGeoJSON(${entities.location}) as location`,
      })
      .from(entities)
      .where(inArray(entities.id, entityIds));
    const entitiesById = Object.fromEntries(
      (
        await serialize(EntitySerializer, entityList, currentUser, [
          "description",
        ])
      ).map((data, index) => [entityList[index].id, data]),
    );

    const distillersByBottleId: {
      [bottleId: number]: ReturnType<(typeof EntitySerializer)["item"]>[];
    } = {};
    distillerList.forEach((d) => {
      if (!distillersByBottleId[d.bottleId])
        distillersByBottleId[d.bottleId] = [entitiesById[d.distillerId]];
      else distillersByBottleId[d.bottleId].push(entitiesById[d.distillerId]);
    });

    const favoriteSet = currentUser
      ? new Set(
          (
            await db
              .selectDistinct({ id: collectionBottles.bottleId })
              .from(collectionBottles)
              .innerJoin(
                collections,
                eq(collectionBottles.collectionId, collections.id),
              )
              .where(
                and(
                  inArray(collectionBottles.bottleId, itemIds),
                  eq(collections.name, "Default"),
                  eq(collections.createdById, currentUser.id),
                ),
              )
          ).map((r) => r.id),
        )
      : new Set();

    // identify bottles which have a tasting recorded for the current user
    // note: this is contextual based on the query - if they're asking for a flight,
    // said flight should be available in the context and this will reflect
    // if they've recorded a tasting _in that context_
    const tastedSet = currentUser
      ? new Set(
          (context?.flight
            ? await db
                .selectDistinct({ id: tastings.bottleId })
                .from(tastings)
                .where(
                  and(
                    inArray(tastings.bottleId, itemIds),
                    eq(tastings.flightId, context.flight.id),
                    eq(tastings.createdById, currentUser.id),
                  ),
                )
            : await db
                .selectDistinct({ id: tastings.bottleId })
                .from(tastings)
                .where(
                  and(
                    inArray(tastings.bottleId, itemIds),
                    eq(tastings.createdById, currentUser.id),
                  ),
                )
          ).map((r) => r.id),
        )
      : new Set();

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            isFavorite: favoriteSet.has(item.id),
            hasTasted: tastedSet.has(item.id),
            brand: entitiesById[item.brandId],
            distillers: distillersByBottleId[item.id] || [],
            bottler: item.bottlerId ? entitiesById[item.bottlerId] : null,
          },
        ];
      }),
    );
  },

  item: (
    item: Bottle,
    attrs: Attrs,
    currentUser?: User,
    context?: Context,
  ): z.infer<typeof BottleSchema> => {
    return {
      id: item.id,
      name: item.name,
      fullName: item.fullName,
      description: item.description,
      flavorProfile: item.flavorProfile,
      tastingNotes: item.tastingNotes,
      statedAge: item.statedAge,
      category: item.category,
      brand: attrs.brand,
      distillers: attrs.distillers,
      bottler: attrs.bottler,
      avgRating: item.avgRating,
      totalTastings: item.totalTastings,
      suggestedTags: item.suggestedTags,
      isFavorite: attrs.isFavorite,
      hasTasted: attrs.hasTasted,
    };
  },
});
