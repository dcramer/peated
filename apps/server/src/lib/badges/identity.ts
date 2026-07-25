import type { AnyDatabase } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import { inArray } from "drizzle-orm";
import type {
  BadgeIdentity,
  BadgeIdentityEntity,
  BadgeTasting,
  PersistedBadgeTasting,
} from "./types";

/** Hydrates the one authoritative badge identity for each persisted Tasting. */
export async function loadBadgeTastings(
  database: AnyDatabase,
  tastings: PersistedBadgeTasting[],
): Promise<BadgeTasting[]> {
  if (tastings.length === 0) return [];

  const bottleIds = [
    ...new Set(
      tastings.map((tasting) => {
        if (tasting.bottleId === null) {
          throw new Error(`Tasting ${tasting.id} has no Bottle.`);
        }
        return tasting.bottleId;
      }),
    ),
  ];
  const [bottleRows, distillerRows, tombstones] = await Promise.all([
    database.select().from(bottles).where(inArray(bottles.id, bottleIds)),
    database
      .select()
      .from(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, bottleIds)),
    database
      .select({ bottleId: bottleTombstones.bottleId })
      .from(bottleTombstones)
      .where(inArray(bottleTombstones.bottleId, bottleIds)),
  ]);
  const retiredBottleIds = new Set(tombstones.map(({ bottleId }) => bottleId));
  const distillerIdsByBottleId = new Map<number, number[]>();
  for (const { bottleId, distillerId } of distillerRows) {
    const current = distillerIdsByBottleId.get(bottleId) ?? [];
    current.push(distillerId);
    distillerIdsByBottleId.set(bottleId, current);
  }
  const bottleById = new Map(
    bottleRows.map((bottle) => [
      bottle.id,
      {
        ...bottle,
        distillerIds: distillerIdsByBottleId.get(bottle.id) ?? [],
      },
    ]),
  );

  const alignedBottles = tastings.map((tasting) => {
    const bottle = bottleById.get(tasting.bottleId!);
    if (!bottle || retiredBottleIds.has(bottle.id)) {
      throw new Error(
        `Tasting ${tasting.id} references inactive Bottle ${tasting.bottleId}.`,
      );
    }
    return { tasting, bottle };
  });

  const ownerIds = new Set<number>();
  for (const { bottle } of alignedBottles) {
    ownerIds.add(bottle.brandId);
    if (bottle.bottlerId !== null) ownerIds.add(bottle.bottlerId);
    for (const distillerId of bottle.distillerIds) ownerIds.add(distillerId);
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

  return alignedBottles.map(({ tasting, bottle }) => {
    const requireEntity = (entityId: number): BadgeIdentityEntity => {
      const entity = entitiesById.get(entityId);
      if (!entity) {
        throw new Error(`Badge identity references missing Entity ${entityId}`);
      }
      return entity;
    };
    const identity: BadgeIdentity = {
      kind: "bottle",
      bottleId: bottle.id,
      statedAge: bottle.statedAge,
      category: bottle.category,
      brand: requireEntity(bottle.brandId),
      bottler:
        bottle.bottlerId === null ? null : requireEntity(bottle.bottlerId),
      distillers: Array.from(new Set(bottle.distillerIds), requireEntity),
    };

    return {
      id: tasting.id,
      createdById: tasting.createdById,
      identity,
    };
  });
}
