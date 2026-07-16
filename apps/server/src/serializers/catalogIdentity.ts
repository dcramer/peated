/**
 * Sole DB-to-runtime mapper for catalog identity projections. Every caller
 * supplies explicit actor and read-permission context.
 */
import config from "@peated/server/config";
import type {
  Actor,
  Bottle,
  BottleGroup,
  CatalogTarget,
  User,
} from "@peated/server/db/schema";
import { absoluteUrl } from "@peated/server/lib/urls";
import {
  BottleGroupV1Schema,
  CATALOG_IDENTITY_SCHEMA_VERSION,
  CatalogTargetV1Schema,
  ConcreteBottleV1Schema,
  type BottleGroupV1,
  type CatalogTargetV1,
  type ConcreteBottleV1,
} from "@peated/server/schemas/catalogIdentity";
import { serialize, serializer } from ".";

export type CatalogIdentitySerializerContext = {
  actor: Pick<Actor, "id" | "type"> | null;
  permissions: {
    canReadCatalogIdentity: boolean;
  };
};

export type BottleGroupSummarySerializerItem = BottleGroup & {
  distillerIds: readonly number[];
};

export type ConcreteBottleSerializerItem = Bottle & {
  distillerIds: readonly number[];
};

export type CatalogTargetSerializerItem = CatalogTarget & {
  group: BottleGroupSummarySerializerItem;
  bottle: ConcreteBottleSerializerItem | null;
};

function requireReadContext(
  context?: CatalogIdentitySerializerContext,
): asserts context is CatalogIdentitySerializerContext {
  if (!context) {
    throw new Error("Catalog identity serialization requires caller context");
  }
  if (!context.permissions.canReadCatalogIdentity) {
    throw new Error("Catalog identity read permission is required");
  }
}

function serializeImageUrl(imageUrl: string | null): string | null {
  return imageUrl ? absoluteUrl(config.API_SERVER, imageUrl) : null;
}

export const BottleGroupSummarySerializer = serializer({
  name: "bottleGroupSummary",
  item: (
    item: BottleGroupSummarySerializerItem,
    _attrs: Record<string, never>,
    _currentUser?: User | null,
    context?: CatalogIdentitySerializerContext,
  ): BottleGroupV1 => {
    requireReadContext(context);

    return BottleGroupV1Schema.parse({
      schemaVersion: CATALOG_IDENTITY_SCHEMA_VERSION,
      id: item.id,
      fullName: item.fullName,
      name: item.name,
      brandId: item.brandId,
      bottlerId: item.bottlerId,
      distillerIds: [...item.distillerIds].sort((a, b) => a - b),
      category: item.category,
      seriesId: item.seriesId,
      statedAge: item.statedAge,
      representativeBottleId: item.representativeBottleId,
      description: item.description,
      descriptionSrc: item.descriptionSrc,
      imageUrl: serializeImageUrl(item.imageUrl),
      flavorProfile: item.flavorProfile,
      tastingNotes: item.tastingNotes,
      suggestedTags: item.suggestedTags,
      avgRating: item.avgRating,
      ratingStats: item.ratingStats,
      totalTastings: item.totalTastings,
      totalBottles: item.totalBottles,
      createdByActorId: item.createdByActorId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  },
});

export const ConcreteBottleSerializer = serializer({
  name: "concreteBottle",
  item: (
    item: ConcreteBottleSerializerItem,
    _attrs: Record<string, never>,
    _currentUser?: User | null,
    context?: CatalogIdentitySerializerContext,
  ): ConcreteBottleV1 => {
    requireReadContext(context);

    return ConcreteBottleV1Schema.parse({
      schemaVersion: CATALOG_IDENTITY_SCHEMA_VERSION,
      id: item.id,
      groupId: item.groupId,
      fullName: item.fullName,
      name: item.name,
      brandId: item.brandId,
      bottlerId: item.bottlerId,
      distillerIds: [...item.distillerIds].sort((a, b) => a - b),
      category: item.category,
      seriesId: item.seriesId,
      flavorProfile: item.flavorProfile,
      edition: item.edition,
      statedAge: item.statedAge,
      abv: item.abv,
      singleCask: item.singleCask,
      caskStrength: item.caskStrength,
      vintageYear: item.vintageYear,
      releaseYear: item.releaseYear,
      caskSize: item.caskSize,
      caskType: item.caskType,
      caskFill: item.caskFill,
      description: item.description,
      descriptionSrc: item.descriptionSrc,
      imageUrl: serializeImageUrl(item.imageUrl),
      tastingNotes: item.tastingNotes,
      suggestedTags: item.suggestedTags,
      avgRating: item.avgRating,
      ratingStats: item.ratingStats,
      totalTastings: item.totalTastings,
      createdByActorId: item.createdByActorId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  },
});

type CatalogTargetAttrs = {
  group: BottleGroupV1;
  bottle: ConcreteBottleV1 | null;
};

export const CatalogTargetSerializer = serializer({
  name: "catalogTarget",
  attrs: async (
    itemList: CatalogTargetSerializerItem[],
    _currentUser?: User | null,
    context?: CatalogIdentitySerializerContext,
  ): Promise<Record<number, CatalogTargetAttrs>> => {
    requireReadContext(context);

    const groups = await serialize(
      BottleGroupSummarySerializer,
      itemList.map((item) => item.group),
      undefined,
      [],
      context,
    );
    const exactItems = itemList.filter(
      (
        item,
      ): item is CatalogTargetSerializerItem & {
        bottle: ConcreteBottleSerializerItem;
      } => item.bottle !== null,
    );
    const bottles = await serialize(
      ConcreteBottleSerializer,
      exactItems.map((item) => item.bottle),
      undefined,
      [],
      context,
    );
    const groupByTargetId = Object.fromEntries(
      itemList.map((item, index) => [item.id, groups[index]]),
    );
    const bottleByTargetId = Object.fromEntries(
      exactItems.map((item, index) => [item.id, bottles[index]]),
    );

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          group: groupByTargetId[item.id],
          bottle: bottleByTargetId[item.id] ?? null,
        },
      ]),
    );
  },
  item: (
    item: CatalogTargetSerializerItem,
    attrs: CatalogTargetAttrs,
    _currentUser?: User | null,
    context?: CatalogIdentitySerializerContext,
  ): CatalogTargetV1 => {
    requireReadContext(context);

    if (item.groupId !== item.group.id) {
      throw new Error(`Catalog target ${item.id} has a mismatched group`);
    }

    if (item.bottleId === null) {
      if (item.bottle !== null) {
        throw new Error(`Generic catalog target ${item.id} hydrated a Bottle`);
      }

      return CatalogTargetV1Schema.parse({
        schemaVersion: CATALOG_IDENTITY_SCHEMA_VERSION,
        kind: "group",
        targetId: item.id,
        group: attrs.group,
      });
    }

    if (
      !item.bottle ||
      item.bottle.id !== item.bottleId ||
      item.bottle.groupId !== item.groupId
    ) {
      throw new Error(
        `Exact catalog target ${item.id} has a mismatched Bottle`,
      );
    }

    return CatalogTargetV1Schema.parse({
      schemaVersion: CATALOG_IDENTITY_SCHEMA_VERSION,
      kind: "bottle",
      targetId: item.id,
      group: attrs.group,
      bottle: attrs.bottle,
    });
  },
});
