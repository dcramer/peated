import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleReleases,
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
import { upsertBottleAlias } from "@peated/server/lib/db";
import { formatBottleName, formatReleaseName } from "@peated/server/lib/format";
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
import { ConflictError } from "@peated/server/orpc/errors";
import { pushUniqueJob } from "@peated/server/worker/client";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

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

// TODO: this should happen async
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
  const updatedBottleIds: number[] = [];
  const updatedAliasNames = new Set<string>();
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

    // Pre-flattening rows remain an explicitly migration-only compatibility
    // branch. OpenSpec task 9.7 removes it after every Bottle owns a group/target.
    const legacyBottleList = await tx
      .select()
      .from(bottles)
      .where(
        and(isNull(bottles.groupId), inArray(bottles.brandId, fromEntityIds)),
      );
    for (const bottle of legacyBottleList) {
      const fullName = formatBottleName({
        ...bottle,
        name: `${toEntity.shortName || toEntity.name} ${bottle.name}`,
      });
      const alias = await upsertBottleAlias(tx, fullName, bottle.id, null, {
        assignedByActorId: actor.id,
      });
      if (alias.bottleId && alias.bottleId !== bottle.id) {
        const [existingBottle] = await tx
          .select()
          .from(bottles)
          .where(eq(bottles.id, alias.bottleId));
        if (existingBottle.brandId !== toEntity.id) {
          throw new ConflictError(
            existingBottle,
            undefined,
            "An error occurred while trying to merge duplicate bottles.",
          );
        }
        bottleMergeManifests.push(
          await mergeConcreteBottlesInTransaction(tx, {
            sourceBottleId: bottle.id,
            destinationBottleId: alias.bottleId,
            actorId: actor.id,
          }),
        );
        continue;
      }

      await tx
        .update(bottles)
        .set({ brandId: toEntity.id, fullName })
        .where(eq(bottles.id, bottle.id));
      const releases = await tx
        .select()
        .from(bottleReleases)
        .where(eq(bottleReleases.bottleId, bottle.id));
      for (const release of releases) {
        const next = {
          name: formatReleaseName({
            name: bottle.name,
            edition: release.edition,
            abv: release.abv,
            statedAge: bottle.statedAge ? null : release.statedAge,
            releaseYear: release.releaseYear,
            vintageYear: release.vintageYear,
            singleCask: release.singleCask,
            caskStrength: release.caskStrength,
            caskFill: release.caskFill,
            caskType: release.caskType,
            caskSize: release.caskSize,
          }),
          fullName: formatReleaseName({
            name: fullName,
            edition: release.edition,
            abv: release.abv,
            statedAge: bottle.statedAge ? null : release.statedAge,
            releaseYear: release.releaseYear,
            vintageYear: release.vintageYear,
            singleCask: release.singleCask,
            caskStrength: release.caskStrength,
            caskFill: release.caskFill,
            caskType: release.caskType,
            caskSize: release.caskSize,
          }),
        };
        await tx
          .update(bottleReleases)
          .set(next)
          .where(eq(bottleReleases.id, release.id));
        const releaseAlias = await upsertBottleAlias(
          tx,
          next.fullName,
          bottle.id,
          release.id,
          { assignedByActorId: actor.id },
        );
        if (
          releaseAlias.bottleId !== bottle.id ||
          (releaseAlias.releaseId ?? null) !== release.id
        ) {
          throw new Error(
            "Release alias already belongs to a different bottle.",
          );
        }
        updatedAliasNames.add(next.fullName);
      }
      updatedBottleIds.push(bottle.id);
    }

    const legacyBottleIds = await tx
      .select({ id: bottles.id })
      .from(bottles)
      .where(isNull(bottles.groupId));
    await tx
      .update(bottles)
      .set({ bottlerId: toEntity.id })
      .where(
        and(isNull(bottles.groupId), inArray(bottles.bottlerId, fromEntityIds)),
      );
    await tx
      .update(entityAliases)
      .set({ entityId: toEntity.id })
      .where(inArray(entityAliases.entityId, fromEntityIds));
    if (legacyBottleIds.length) {
      await tx
        .update(bottlesToDistillers)
        .set({ distillerId: toEntity.id })
        .where(
          and(
            inArray(
              bottlesToDistillers.bottleId,
              legacyBottleIds.map(({ id }) => id),
            ),
            inArray(bottlesToDistillers.distillerId, fromEntityIds),
          ),
        );
    }

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
          .update(bottles)
          .set({ seriesId: targetSeries.id })
          .where(
            and(isNull(bottles.groupId), eq(bottles.seriesId, sourceSeries.id)),
          );
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
  for (const bottleId of updatedBottleIds) {
    try {
      await pushUniqueJob(
        "IndexBottleSearchVectors",
        { bottleId },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, { bottle: { id: bottleId } });
    }
  }
  for (const name of updatedAliasNames) {
    try {
      await pushUniqueJob("OnBottleAliasChange", { name }, { delay: 5000 });
    } catch (err) {
      logError(err, { alias: { name } });
    }
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
