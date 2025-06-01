import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Bottle, Flight, User } from "../db/schema";
import {
  bottleSeries,
  bottlesToDistillers,
  collectionBottles,
  collections,
  entities,
  tastings,
} from "../db/schema";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import type { BottleSchema } from "../schemas";
import { BottleSeriesSerializer } from "./bottleSeries";
import { EntitySerializer } from "./entity";

type Attrs = {
  isFavorite: boolean;
  hasTasted: boolean;
  brand: ReturnType<(typeof EntitySerializer)["item"]>;
  distillers: ReturnType<(typeof EntitySerializer)["item"]>[];
  bottler: ReturnType<(typeof EntitySerializer)["item"]> | null;
  series: ReturnType<(typeof BottleSeriesSerializer)["item"]> | null;
};

type Context =
  | {
      flight?: Flight | null;
    }
  | undefined;

export const BottleSerializer = serializer({
  name: "bottle",
  attrs: async (
    itemList: Bottle[],
    currentUser?: User,
    context?: Context
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
        ].filter(notEmpty)
      )
    );

    const entityList = await db
      .select()
      .from(entities)
      .where(inArray(entities.id, entityIds));
    const entitiesById = Object.fromEntries(
      (
        await serialize(EntitySerializer, entityList, currentUser, [
          "description",
        ])
      ).map((data, index) => [entityList[index].id, data])
    );

    const seriesIds = Array.from(
      new Set(itemList.map((i) => i.seriesId).filter(notEmpty))
    );
    const seriesList = await db
      .select()
      .from(bottleSeries)
      .where(inArray(bottleSeries.id, seriesIds));
    const seriesById = Object.fromEntries(
      (await serialize(BottleSeriesSerializer, seriesList, currentUser)).map(
        (data, index) => [seriesList[index].id, data]
      )
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
              .selectDistinct({ bottleId: collectionBottles.bottleId })
              .from(collectionBottles)
              .innerJoin(
                collections,
                eq(collectionBottles.collectionId, collections.id)
              )
              .where(
                and(
                  inArray(collectionBottles.bottleId, itemIds),
                  sql`LOWER(${collections.name}) = 'default'`,
                  eq(collections.createdById, currentUser.id)
                )
              )
          ).map((r) => r.bottleId)
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
                .selectDistinct({ bottleId: tastings.bottleId })
                .from(tastings)
                .where(
                  and(
                    inArray(tastings.bottleId, itemIds),
                    eq(tastings.flightId, context.flight.id),
                    eq(tastings.createdById, currentUser.id)
                  )
                )
            : await db
                .selectDistinct({ bottleId: tastings.bottleId })
                .from(tastings)
                .where(
                  and(
                    inArray(tastings.bottleId, itemIds),
                    eq(tastings.createdById, currentUser.id)
                  )
                )
          ).map((r) => r.bottleId)
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
            series: item.seriesId ? seriesById[item.seriesId] : null,
          },
        ];
      })
    );
  },

  item: (
    item: Bottle,
    attrs: Attrs,
    currentUser?: User,
    context?: Context
  ): z.infer<typeof BottleSchema> => {
    return {
      id: item.id,

      // fullName is brand + name
      fullName: item.fullName,
      name: item.name,

      statedAge: item.statedAge,

      category: item.category,
      description: item.description,
      flavorProfile: item.flavorProfile,
      tastingNotes: item.tastingNotes,

      edition: item.edition,
      caskStrength: item.caskStrength,
      singleCask: item.singleCask,
      abv: item.abv,

      vintageYear: item.vintageYear,
      releaseYear: item.releaseYear,

      caskType: item.caskType,
      caskFill: item.caskFill,
      caskSize: item.caskSize,

      brand: attrs.brand,
      distillers: attrs.distillers,
      bottler: attrs.bottler,
      series: attrs.series,

      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,

      avgRating: item.avgRating,
      totalTastings: item.totalTastings,
      numReleases: item.numReleases,

      suggestedTags: item.suggestedTags,
      isFavorite: attrs.isFavorite,
      hasTasted: attrs.hasTasted,

      createdAt: item.createdAt.toISOString(),
      updatedAt: item.createdAt.toISOString(),
    };
  },
});
