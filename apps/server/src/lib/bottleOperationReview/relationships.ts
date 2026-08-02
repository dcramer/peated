import type { AnyDatabase } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
} from "@peated/server/db/schema";
import { asc, eq, inArray, or } from "drizzle-orm";
import { sortedUnique } from "./shared";

export async function bottleRelationshipStates(
  database: AnyDatabase,
  bottleIds: readonly number[],
) {
  const ids = sortedUnique(bottleIds);
  if (ids.length === 0) return [];
  const bottleRows = await database
    .select({
      bottleId: bottles.id,
      groupId: bottles.groupId,
      brandId: bottles.brandId,
      bottlerId: bottles.bottlerId,
      seriesId: bottles.seriesId,
    })
    .from(bottles)
    .where(inArray(bottles.id, ids))
    .orderBy(asc(bottles.id));
  const distillerRows = await database
    .select({
      bottleId: bottlesToDistillers.bottleId,
      distillerId: bottlesToDistillers.distillerId,
    })
    .from(bottlesToDistillers)
    .where(inArray(bottlesToDistillers.bottleId, ids))
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    );
  const distillersByBottle = new Map<number, number[]>();
  for (const { bottleId, distillerId } of distillerRows) {
    const current = distillersByBottle.get(bottleId) ?? [];
    current.push(distillerId);
    distillersByBottle.set(bottleId, current);
  }
  return bottleRows.map((row) => ({
    ...row,
    distillerIds: distillersByBottle.get(row.bottleId) ?? [],
  }));
}

export async function relationshipStateForGroups(
  database: AnyDatabase,
  groupIds: readonly number[],
) {
  const ids = sortedUnique(groupIds);
  if (ids.length === 0) return [];
  const groupRows = await database
    .select({
      groupId: bottleGroups.id,
      brandId: bottleGroups.brandId,
      bottlerId: bottleGroups.bottlerId,
      seriesId: bottleGroups.seriesId,
    })
    .from(bottleGroups)
    .where(inArray(bottleGroups.id, ids))
    .orderBy(asc(bottleGroups.id));
  const memberRows = await database
    .select({ groupId: bottles.groupId, bottleId: bottles.id })
    .from(bottles)
    .where(inArray(bottles.groupId, ids))
    .orderBy(asc(bottles.groupId), asc(bottles.id));
  const distillerRows = await database
    .select({
      groupId: bottleGroupDistillers.groupId,
      distillerId: bottleGroupDistillers.distillerId,
    })
    .from(bottleGroupDistillers)
    .where(inArray(bottleGroupDistillers.groupId, ids))
    .orderBy(
      asc(bottleGroupDistillers.groupId),
      asc(bottleGroupDistillers.distillerId),
    );
  const membersByGroup = new Map<number, number[]>();
  for (const { groupId, bottleId } of memberRows) {
    if (groupId === null) continue;
    const current = membersByGroup.get(groupId) ?? [];
    current.push(bottleId);
    membersByGroup.set(groupId, current);
  }
  const distillersByGroup = new Map<number, number[]>();
  for (const { groupId, distillerId } of distillerRows) {
    const current = distillersByGroup.get(groupId) ?? [];
    current.push(distillerId);
    distillersByGroup.set(groupId, current);
  }
  return groupRows.map((row) => ({
    ...row,
    distillerIds: distillersByGroup.get(row.groupId) ?? [],
    memberBottleIds: membersByGroup.get(row.groupId) ?? [],
  }));
}

export async function entityRelationshipState(
  database: AnyDatabase,
  entityIds: readonly number[],
  brandOnly = false,
) {
  const ids = sortedUnique(entityIds);
  if (ids.length === 0) {
    return { groups: [], bottles: [], series: [] };
  }
  const groupRows = await database
    .selectDistinct({ groupId: bottleGroups.id })
    .from(bottleGroups)
    .leftJoin(
      bottleGroupDistillers,
      eq(bottleGroupDistillers.groupId, bottleGroups.id),
    )
    .where(
      brandOnly
        ? inArray(bottleGroups.brandId, ids)
        : or(
            inArray(bottleGroups.brandId, ids),
            inArray(bottleGroups.bottlerId, ids),
            inArray(bottleGroupDistillers.distillerId, ids),
          ),
    )
    .orderBy(asc(bottleGroups.id));
  const legacyBottleRows = brandOnly
    ? []
    : await database
        .selectDistinct({ bottleId: bottles.id })
        .from(bottles)
        .leftJoin(
          bottlesToDistillers,
          eq(bottlesToDistillers.bottleId, bottles.id),
        )
        .where(
          or(
            inArray(bottles.brandId, ids),
            inArray(bottles.bottlerId, ids),
            inArray(bottlesToDistillers.distillerId, ids),
          ),
        )
        .orderBy(asc(bottles.id));
  const groups = await relationshipStateForGroups(
    database,
    groupRows.map(({ groupId }) => groupId),
  );
  const bottleIds = sortedUnique([
    ...groups.flatMap(({ memberBottleIds }) => memberBottleIds),
    ...legacyBottleRows.map(({ bottleId }) => bottleId),
  ]);
  const bottleStates = await bottleRelationshipStates(database, bottleIds);
  const seriesRows = await database
    .select({
      seriesId: bottleSeries.id,
      brandId: bottleSeries.brandId,
    })
    .from(bottleSeries)
    .where(inArray(bottleSeries.brandId, ids))
    .orderBy(asc(bottleSeries.id));
  return { groups, bottles: bottleStates, series: seriesRows };
}
