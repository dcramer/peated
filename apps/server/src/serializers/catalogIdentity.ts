/** Maps shared group identity and aggregates with explicit read context. */
import type { Actor, BottleGroup, User } from "@peated/server/db/schema";
import {
  BottleGroupV1Schema,
  CATALOG_IDENTITY_SCHEMA_VERSION,
  type BottleGroupV1,
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
      flavorProfile: item.flavorProfile,
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
