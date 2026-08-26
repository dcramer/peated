import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { Bottle, User } from "../db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleSeries,
  bottlesToDistillers,
  collectionBottles,
  entities,
  tastings,
} from "../db/schema";
import { getReservedCollection, type ReservedCollectionSlug } from "../lib/db";
import { notEmpty } from "../lib/filter";
import { formatPeatedId } from "../lib/peatedId";
import { absoluteUrl } from "../lib/urls";
import { type BottleSchema } from "../schemas";
import type { BottleGroupV1 } from "../schemas/catalogIdentity";
import { BottleSeriesSerializer } from "./bottleSeries";
import { BottleGroupSummarySerializer } from "./catalogIdentity";
import { EntitySerializer } from "./entity";

type Attrs = {
  isFavorite: boolean;
  isLibrary: boolean;
  hasTasted: boolean;
  group?: BottleGroupV1;
  brand: ReturnType<(typeof EntitySerializer)["item"]>;
  distillers: ReturnType<(typeof EntitySerializer)["item"]>[];
  bottler: ReturnType<(typeof EntitySerializer)["item"]> | null;
  series: ReturnType<(typeof BottleSeriesSerializer)["item"]> | null;
};

export type BottleSerializerContext = {
  includeGroupSummary?: boolean;
};

export const BottleSerializer = serializer({
  name: "bottle",
  attrs: async (
    itemList: Bottle[],
    currentUser?: User,
    context?: BottleSerializerContext,
  ): Promise<Record<number, Attrs>> => {
    const itemIds = itemList.map((t) => t.id);
    const groupByBottleId = new Map<number, BottleGroupV1>();
    if (context?.includeGroupSummary) {
      const groupIds = Array.from(
        new Set(itemList.map(({ groupId }) => groupId).filter(notEmpty)),
      );
      const [groupList, groupDistillerList] = groupIds.length
        ? await Promise.all([
            db
              .select()
              .from(bottleGroups)
              .where(inArray(bottleGroups.id, groupIds)),
            db
              .select()
              .from(bottleGroupDistillers)
              .where(inArray(bottleGroupDistillers.groupId, groupIds)),
          ])
        : [[], []];
      const distillerIdsByGroupId = new Map<number, number[]>();
      for (const { groupId, distillerId } of groupDistillerList) {
        const distillerIds = distillerIdsByGroupId.get(groupId) ?? [];
        distillerIds.push(distillerId);
        distillerIdsByGroupId.set(groupId, distillerIds);
      }
      const groupSummaries = await serialize(
        BottleGroupSummarySerializer,
        groupList.map((group) => ({
          ...group,
          distillerIds: distillerIdsByGroupId.get(group.id) ?? [],
        })),
        undefined,
        [],
        {
          actor: null,
          permissions: { canReadCatalogIdentity: true },
        },
      );
      const groupById = new Map(
        groupList.map(
          (group, index) => [group.id, groupSummaries[index]] as const,
        ),
      );

      for (const item of itemList) {
        const group =
          item.groupId === null ? undefined : groupById.get(item.groupId);
        if (!group) {
          throw new Error(
            `Bottle ${item.id} does not belong to an active BottleGroup.`,
          );
        }
        groupByBottleId.set(item.id, group);
      }
    }

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
      .select()
      .from(entities)
      .where(inArray(entities.id, entityIds));
    const entitiesById = Object.fromEntries(
      (
        await serialize(EntitySerializer, entityList, currentUser, [
          "description",
        ])
      ).map((data, index) => [entityList[index].id, data]),
    );

    const seriesIds = Array.from(
      new Set(itemList.map((i) => i.seriesId).filter(notEmpty)),
    );
    const seriesList = await db
      .select()
      .from(bottleSeries)
      .where(inArray(bottleSeries.id, seriesIds));
    const seriesById = Object.fromEntries(
      (await serialize(BottleSeriesSerializer, seriesList, currentUser)).map(
        (data, index) => [seriesList[index].id, data],
      ),
    );

    const distillersByBottleId: {
      [bottleId: number]: ReturnType<(typeof EntitySerializer)["item"]>[];
    } = {};
    distillerList.forEach((d) => {
      if (!distillersByBottleId[d.bottleId])
        distillersByBottleId[d.bottleId] = [entitiesById[d.distillerId]];
      else distillersByBottleId[d.bottleId].push(entitiesById[d.distillerId]);
    });

    const getReservedCollectionBottleSet = async (
      collectionSlug: ReservedCollectionSlug,
    ) => {
      if (!currentUser || !itemIds.length) {
        return new Set<number>();
      }

      const collection = await getReservedCollection(
        db,
        currentUser.id,
        collectionSlug,
      );
      if (!collection) {
        return new Set<number>();
      }

      return new Set(
        (
          await db
            .selectDistinct({ bottleId: collectionBottles.bottleId })
            .from(collectionBottles)
            .where(
              and(
                inArray(collectionBottles.bottleId, itemIds),
                eq(collectionBottles.collectionId, collection.id),
              ),
            )
        ).flatMap(({ bottleId }) => (bottleId === null ? [] : [bottleId])),
      );
    };

    const [favoriteSet, librarySet] = await Promise.all([
      getReservedCollectionBottleSet("default"),
      getReservedCollectionBottleSet("library"),
    ]);

    const tastedSet =
      currentUser && itemIds.length
        ? new Set(
            (
              await db
                .selectDistinct({ bottleId: tastings.bottleId })
                .from(tastings)
                .where(
                  and(
                    inArray(tastings.bottleId, itemIds),
                    eq(tastings.createdById, currentUser.id),
                  ),
                )
            ).flatMap(({ bottleId }) => (bottleId === null ? [] : [bottleId])),
          )
        : new Set();

    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            isFavorite: favoriteSet.has(item.id),
            isLibrary: librarySet.has(item.id),
            hasTasted: tastedSet.has(item.id),
            group: groupByBottleId.get(item.id),
            brand: entitiesById[item.brandId],
            distillers: distillersByBottleId[item.id] || [],
            bottler: item.bottlerId ? entitiesById[item.bottlerId] : null,
            series: item.seriesId ? seriesById[item.seriesId] : null,
          },
        ];
      }),
    );
  },

  item: (item: Bottle, attrs: Attrs): z.infer<typeof BottleSchema> => {
    const bottle: z.infer<typeof BottleSchema> = {
      id: item.id,
      peatedId: formatPeatedId("bottle", item.id),

      // fullName is brand + name
      fullName: item.fullName,
      name: item.name,

      statedAge: item.statedAge,
      noAgeStatement: item.noAgeStatement,

      category: item.category,
      description: item.description,
      flavorProfile: item.flavorProfile,
      tastingNotes: item.tastingNotes,

      edition: item.edition,
      caskStrength: item.caskStrength,
      singleCask: item.singleCask,
      naturalColor: item.naturalColor,
      nonChillFiltered: item.nonChillFiltered,
      maltPhenolPpm: item.maltPhenolPpm,
      abv: item.abv,

      vintageYear: item.vintageYear,
      bottlingYear: item.bottlingYear,
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
      avgScore: item.avgScore,
      totalScores: item.totalScores,
      ratingStats: item.ratingStats,
      totalTastings: item.totalTastings,

      suggestedTags: item.suggestedTags,
      isFavorite: attrs.isFavorite,
      isLibrary: attrs.isLibrary,
      hasTasted: attrs.hasTasted,

      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
    if (attrs.group) bottle.group = attrs.group;
    return bottle;
  },
});
