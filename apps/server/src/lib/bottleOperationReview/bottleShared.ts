import type { AnyDatabase } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  BottleSeries,
  Entity,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import {
  getBottleExactIdentity,
  type BottleExactIdentity,
} from "@peated/server/lib/bottleIdentity";
import { asc, eq } from "drizzle-orm";
import { fail, loadEntity } from "./shared";

export type BottleResource = {
  bottle: Bottle;
  group: BottleGroup;
  brand: Entity;
  bottler: Entity | null;
  series: BottleSeries | null;
  distillerIds: number[];
  distillers: Entity[];
  aliases: string[];
  tombstoneDestinationBottleId: number | null;
};

export async function loadBottle(
  database: AnyDatabase,
  bottleId: number,
): Promise<BottleResource> {
  const [bottle] = await database
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);
  if (!bottle) {
    fail("resource_not_found", `Bottle ${bottleId} does not exist.`);
  }
  if (!bottle.groupId) {
    fail(
      "invalid_current_state",
      `Bottle ${bottleId} does not have an active BottleGroup.`,
    );
  }
  const [group] = await database
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, bottle.groupId))
    .limit(1);
  if (
    !group ||
    group.representativeBottleId === null ||
    group.brandId !== bottle.brandId
  ) {
    fail(
      "invalid_current_state",
      `Bottle ${bottleId} has an invalid BottleGroup relationship.`,
    );
  }
  const brand = (await loadEntity(database, group.brandId)).entity;
  const bottler = group.bottlerId
    ? (await loadEntity(database, group.bottlerId)).entity
    : null;
  const series = group.seriesId
    ? ((
        await database
          .select()
          .from(bottleSeries)
          .where(eq(bottleSeries.id, group.seriesId))
          .limit(1)
      )[0] ?? null)
    : null;
  if (group.seriesId && !series) {
    fail(
      "invalid_current_state",
      `BottleGroup ${group.id} references missing series ${group.seriesId}.`,
    );
  }
  const distillerRows = await database
    .select({ entity: entities })
    .from(bottleGroupDistillers)
    .innerJoin(entities, eq(entities.id, bottleGroupDistillers.distillerId))
    .where(eq(bottleGroupDistillers.groupId, group.id))
    .orderBy(asc(entities.id));
  const aliases = await database
    .select({ name: bottleAliases.name })
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, bottle.id))
    .orderBy(asc(bottleAliases.name));
  const [tombstone] = await database
    .select({ newBottleId: bottleTombstones.newBottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottle.id))
    .limit(1);
  if (tombstone) {
    fail("invalid_current_state", `Bottle ${bottle.id} is already retired.`);
  }

  return {
    bottle,
    group,
    brand,
    bottler,
    series,
    distillerIds: distillerRows.map(({ entity }) => entity.id),
    distillers: distillerRows.map(({ entity }) => entity),
    aliases: aliases.map(({ name }) => name),
    tombstoneDestinationBottleId: null,
  };
}

export function existingEntityChoice(entity: Entity) {
  return {
    kind: "existing" as const,
    entityId: entity.id,
    name: entity.name,
    shortName: entity.shortName,
    entityKind: entity.kind!,
  };
}

export function bottleExact(resource: BottleResource): BottleExactIdentity {
  return getBottleExactIdentity({
    bottle: resource.bottle,
    sourceGroupStatedAge: resource.group.statedAge,
  });
}

export function bottlePreviewState(resource: BottleResource) {
  return {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    fullName: resource.bottle.fullName,
    shared: {
      name: resource.group.name,
      statedAge: resource.group.statedAge,
      seriesId: resource.group.seriesId,
      category: resource.group.category,
      brand: existingEntityChoice(resource.brand),
      distillers: resource.distillers.map(existingEntityChoice),
      bottler: resource.bottler ? existingEntityChoice(resource.bottler) : null,
    },
    exact: bottleExact(resource),
  };
}
