/**
 * Sole DB-to-runtime mapper for catalog identity projections. Every caller
 * supplies explicit actor and read-permission context.
 */
import config from "@peated/server/config";
import type {
  Actor,
  Bottle,
  BottleGroup,
  User,
} from "@peated/server/db/schema";
import { absoluteUrl } from "@peated/server/lib/urls";
import {
  BottleGroupV1Schema,
  CATALOG_IDENTITY_SCHEMA_VERSION,
  ConcreteBottleV1Schema,
  type BottleGroupV1,
  type ConcreteBottleV1,
} from "@peated/server/schemas/catalogIdentity";
import { serializer } from ".";

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

export function assertCatalogIdentityReadContext(
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
    assertCatalogIdentityReadContext(context);

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
    assertCatalogIdentityReadContext(context);

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
