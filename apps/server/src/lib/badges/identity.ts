import type { AnyDatabase } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { loadCatalogTargetReadsWithParity } from "@peated/server/lib/catalogTargetReadParity";
import { CatalogTargetIntegrityMismatchError } from "@peated/server/lib/catalogTargets";
import { inArray } from "drizzle-orm";
import type {
  BadgeIdentity,
  BadgeIdentityEntity,
  BadgeTasting,
  PersistedBadgeTasting,
} from "./types";

type BadgeTastingReadContext = {
  caller: string;
  operation: string;
};

/** Hydrates the one authoritative badge identity for each persisted Tasting. */
export async function loadBadgeTastings(
  database: AnyDatabase,
  tastings: PersistedBadgeTasting[],
  context: BadgeTastingReadContext,
): Promise<BadgeTasting[]> {
  if (tastings.length === 0) return [];

  const { targets } = await loadCatalogTargetReadsWithParity(
    tastings.map((tasting) => ({
      consumerTable: "tasting" as const,
      rowLocator: { id: tasting.id },
      targetId: tasting.targetId,
      legacy: {
        bottleId: tasting.bottleId,
        releaseId: tasting.releaseId,
      },
    })),
    {
      actor: null,
      permissions: { canReadCatalogIdentity: true },
      ...context,
    },
    database,
  );

  const alignedTargets = targets.map((target, index) => {
    const tasting = tastings[index];
    if (!tasting) {
      throw new Error(`Missing persisted badge Tasting at index ${index}`);
    }
    if (!target) {
      if (tasting.targetId === null && tasting.bottleId === null) {
        throw new Error(`Tasting ${tasting.id} has no catalog identity`);
      }
      throw new CatalogTargetIntegrityMismatchError(
        tasting.targetId !== null
          ? { targetId: tasting.targetId }
          : { bottleId: tasting.bottleId! },
        `Tasting ${tasting.id} has no authoritative CatalogTarget`,
      );
    }
    return { tasting, target };
  });

  const ownerIds = new Set<number>();
  for (const { target } of alignedTargets) {
    const identity = target.kind === "bottle" ? target.bottle : target.group;
    ownerIds.add(identity.brandId);
    if (identity.bottlerId !== null) ownerIds.add(identity.bottlerId);
    for (const distillerId of identity.distillerIds) ownerIds.add(distillerId);
  }

  const entityRows = ownerIds.size
    ? await database
        .select({
          id: entities.id,
          countryId: entities.countryId,
          regionId: entities.regionId,
        })
        .from(entities)
        .where(inArray(entities.id, Array.from(ownerIds)))
    : [];
  const entitiesById = new Map<number, BadgeIdentityEntity>(
    entityRows.map((entity) => [entity.id, entity]),
  );

  return alignedTargets.map(({ tasting, target }) => {
    const source = target.kind === "bottle" ? target.bottle : target.group;
    const requireEntity = (entityId: number): BadgeIdentityEntity => {
      const entity = entitiesById.get(entityId);
      if (!entity) {
        throw new CatalogTargetIntegrityMismatchError(
          { targetId: target.targetId },
          `Badge identity references missing Entity ${entityId}`,
        );
      }
      return entity;
    };
    const shared = {
      statedAge: source.statedAge,
      category: source.category,
      brand: requireEntity(source.brandId),
      bottler:
        source.bottlerId === null ? null : requireEntity(source.bottlerId),
      distillers: Array.from(new Set(source.distillerIds), requireEntity),
    };
    const identity: BadgeIdentity =
      target.kind === "bottle"
        ? { ...shared, kind: "bottle", bottleId: target.bottle.id }
        : { ...shared, kind: "group" };

    return {
      id: tasting.id,
      createdById: tasting.createdById,
      identity,
    };
  });
}
