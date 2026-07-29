import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import {
  getConcreteBottleExactIdentity,
  materializeConcreteBottleForGroup,
} from "@peated/server/lib/concreteBottleIdentity";
import { formatBottleName } from "@peated/server/lib/format";
import { logError, logInfo, logWarn } from "@peated/server/lib/log";
import {
  finalizeConcreteBottleMerge,
  mergeConcreteBottlesInTransaction,
  type ConcreteBottleMergeFinalizationManifest,
} from "@peated/server/lib/mergeConcreteBottles";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import {
  concreteBottleUpdateExpectedSharedState,
  finalizeConcreteBottleUpdate,
  updateConcreteBottleInTransaction,
  type ConcreteBottleUpdateFinalizationManifest,
} from "@peated/server/lib/updateConcreteBottle";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, notInArray, or, sql } from "drizzle-orm";

function replaceMergedEntityIds(
  ids: readonly number[],
  fromEntityIds: readonly number[],
  toEntityId: number,
) {
  const sourceIds = new Set(fromEntityIds);
  return Array.from(
    new Set(ids.map((id) => (sourceIds.has(id) ? toEntityId : id))),
  ).sort((left, right) => left - right);
}

export default async function mergeEntity({
  toEntityId,
  fromEntityIds,
}: {
  toEntityId: number;
  fromEntityIds: number[];
}) {
  logInfo("Merging entities into {toEntityId}", {
    extra: { fromEntityIds, toEntityId },
  });

  const [toEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, toEntityId));
  if (!toEntity) {
    logWarn("Merge target entity not found", { extra: { toEntityId } });
    return;
  }

  const automationUser = await getAutomationModeratorUser();
  const bottleMergeManifests: ConcreteBottleMergeFinalizationManifest[] = [];
  const bottleUpdateManifests: ConcreteBottleUpdateFinalizationManifest[] = [];

  await db.transaction(async (tx) => {
    const actor = await getPeatedSystemActorForDatabase(tx);
    const sourceSeriesRows = await tx
      .select()
      .from(bottleSeries)
      .where(inArray(bottleSeries.brandId, fromEntityIds));
    const sourceSeriesIds = sourceSeriesRows.map(({ id }) => id);

    const authorityGroups = await tx
      .select({ id: bottleGroups.id })
      .from(bottleGroups)
      .leftJoin(
        bottleGroupDistillers,
        eq(bottleGroupDistillers.groupId, bottleGroups.id),
      )
      .where(
        or(
          inArray(bottleGroups.brandId, fromEntityIds),
          inArray(bottleGroups.bottlerId, fromEntityIds),
          inArray(bottleGroupDistillers.distillerId, fromEntityIds),
          sourceSeriesIds.length
            ? inArray(bottleGroups.seriesId, sourceSeriesIds)
            : undefined,
        ),
      );
    const driftedBottleGroups = await tx
      .selectDistinct({ id: bottles.groupId })
      .from(bottles)
      .leftJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.bottleId, bottles.id),
      )
      .where(
        and(
          sql`${bottles.groupId} IS NOT NULL`,
          or(
            inArray(bottles.brandId, fromEntityIds),
            inArray(bottles.bottlerId, fromEntityIds),
            inArray(bottlesToDistillers.distillerId, fromEntityIds),
            sourceSeriesIds.length
              ? inArray(bottles.seriesId, sourceSeriesIds)
              : undefined,
          ),
        ),
      );
    const affectedGroupIds = Array.from(
      new Set(
        [
          ...authorityGroups.map(({ id }) => id),
          ...driftedBottleGroups.map(({ id }) => id),
        ].filter((id): id is number => id !== null),
      ),
    ).sort((left, right) => left - right);

    for (const groupId of affectedGroupIds) {
      let [group] = await tx
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, groupId))
        .limit(1);
      if (!group) continue;

      const groupDistillers = await tx
        .select({ distillerId: bottleGroupDistillers.distillerId })
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, groupId))
        .orderBy(asc(bottleGroupDistillers.distillerId));
      const nextDistillerIds = replaceMergedEntityIds(
        groupDistillers.map(({ distillerId }) => distillerId),
        fromEntityIds,
        toEntityId,
      );
      const brandChanges = fromEntityIds.includes(group.brandId);
      const bottlerChanges =
        group.bottlerId !== null && fromEntityIds.includes(group.bottlerId);
      const distillersChange = groupDistillers.some(({ distillerId }) =>
        fromEntityIds.includes(distillerId),
      );

      let currentSeries: typeof bottleSeries.$inferSelect | null = null;
      let seriesInput:
        | number
        | { name: string; description: string | null }
        | undefined;
      if (group.seriesId !== null) {
        const [series] = await tx
          .select()
          .from(bottleSeries)
          .where(eq(bottleSeries.id, group.seriesId))
          .limit(1);
        currentSeries = series ?? null;
        if (
          series &&
          series.brandId !== toEntityId &&
          (brandChanges || sourceSeriesIds.includes(group.seriesId))
        ) {
          seriesInput = { name: series.name, description: series.description };
        }
      }

      if (brandChanges) {
        const members = await tx
          .select()
          .from(bottles)
          .where(eq(bottles.groupId, groupId))
          .orderBy(
            sql`CASE WHEN ${bottles.id} = ${group.representativeBottleId} THEN 1 ELSE 0 END`,
            asc(bottles.id),
          );
        const targetGroup = {
          ...group,
          brandId: toEntity.id,
          fullName: formatBottleName({
            name: `${toEntity.shortName || toEntity.name} ${group.name}`,
          }),
        };
        for (const member of members) {
          const desired = materializeConcreteBottleForGroup({
            group: targetGroup,
            exact: getConcreteBottleExactIdentity({
              bottle: member,
              sourceGroupStatedAge: group.statedAge,
            }),
          });
          const [duplicate] = await tx
            .select({ id: bottles.id })
            .from(bottles)
            .where(
              and(
                eq(bottles.brandId, toEntityId),
                eq(
                  sql`LOWER(${bottles.fullName})`,
                  desired.fullName.toLowerCase(),
                ),
                notInArray(
                  bottles.id,
                  members.map(({ id }) => id),
                ),
              ),
            )
            .orderBy(asc(bottles.id))
            .limit(1);
          if (!duplicate) continue;
          bottleMergeManifests.push(
            await mergeConcreteBottlesInTransaction(tx, {
              sourceBottleId: member.id,
              destinationBottleId: duplicate.id,
              actorId: actor.id,
            }),
          );
        }

        [group] = await tx
          .select()
          .from(bottleGroups)
          .where(eq(bottleGroups.id, groupId))
          .limit(1);
        if (!group) continue;
      }

      const selectedBottleId = group.representativeBottleId;
      if (selectedBottleId === null) {
        throw new Error(`BottleGroup ${groupId} has no representative Bottle.`);
      }
      bottleUpdateManifests.push(
        await updateConcreteBottleInTransaction(tx, {
          bottleId: selectedBottleId,
          expectedSharedState: concreteBottleUpdateExpectedSharedState({
            group,
            distillerIds: groupDistillers.map(({ distillerId }) => distillerId),
            series: currentSeries,
          }),
          input: {
            shared: {
              brand: brandChanges ? toEntityId : group.brandId,
              ...(bottlerChanges ? { bottler: toEntityId } : {}),
              ...(distillersChange ? { distillers: nextDistillerIds } : {}),
              ...(seriesInput !== undefined ? { series: seriesInput } : {}),
            },
          },
          user: automationUser,
          actorId: actor.id,
          creationSource: "repair_workflow",
        }),
      );
    }

    await tx
      .update(entityAliases)
      .set({ entityId: toEntity.id })
      .where(inArray(entityAliases.entityId, fromEntityIds));

    for (const sourceSeries of sourceSeriesRows) {
      const targetFullName = `${toEntity.name} ${sourceSeries.name}`;
      const [targetSeries] = await tx
        .select()
        .from(bottleSeries)
        .where(
          and(
            eq(bottleSeries.brandId, toEntity.id),
            eq(
              sql`LOWER(${bottleSeries.fullName})`,
              targetFullName.toLowerCase(),
            ),
          ),
        )
        .limit(1);
      if (targetSeries && targetSeries.id !== sourceSeries.id) {
        await tx
          .delete(bottleSeries)
          .where(eq(bottleSeries.id, sourceSeries.id));
        await tx
          .update(bottleSeries)
          .set({
            numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${targetSeries.id})`,
          })
          .where(eq(bottleSeries.id, targetSeries.id));
      } else {
        await tx
          .update(bottleSeries)
          .set({
            brandId: toEntity.id,
            fullName: targetFullName,
            numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${sourceSeries.id})`,
          })
          .where(eq(bottleSeries.id, sourceSeries.id));
      }
    }

    for (const id of fromEntityIds) {
      await tx.insert(entityTombstones).values({
        entityId: id,
        newEntityId: toEntity.id,
      });
    }
    await tx.delete(entities).where(inArray(entities.id, fromEntityIds));
  });

  for (const manifest of bottleMergeManifests) {
    await finalizeConcreteBottleMerge(manifest);
  }
  for (const manifest of bottleUpdateManifests) {
    await finalizeConcreteBottleUpdate(manifest);
  }
  try {
    await pushUniqueJob(
      "OnEntityChange",
      { entityId: toEntityId },
      { delay: 5000 },
    );
  } catch (err) {
    logError(err, { entity: { id: toEntityId } });
  }
}
