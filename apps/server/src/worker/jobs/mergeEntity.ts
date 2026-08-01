import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import {
  getPeatedSystemActorForDatabase,
  getUserActorForDatabase,
} from "@peated/server/lib/actors";
import {
  getConcreteBottleExactIdentity,
  materializeConcreteBottleForGroup,
} from "@peated/server/lib/concreteBottleIdentity";
import {
  EntityMergeOperationExecutionError,
  loadEntityMergeOperation,
  markEntityMergeOperationApplied,
  markEntityMergeOperationFailed,
  revalidateApplyingEntityMergeOperation,
  type LoadedEntityMergeOperation,
} from "@peated/server/lib/entityMergeOperation";
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
import {
  EntityMergeJobInputSchema,
  isOperationEntityMergeJobInput,
} from "@peated/server/worker/entityMerge";
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

type EntityRole = (typeof entities.$inferSelect)["type"][number];

function sortedUniqueEntityRoles(roleSets: readonly EntityRole[][]) {
  return Array.from(new Set(roleSets.flat())).sort() as EntityRole[];
}

function buildOperationResult(
  operation: LoadedEntityMergeOperation,
  reconciled: boolean,
  destinationRoles: EntityRole[],
) {
  return {
    type: "merge_entities" as const,
    sourceEntityId: operation.sourceEntityId,
    destinationEntityId: operation.destinationEntityId,
    destinationRoles,
    approvingModeratorId: operation.approvingModerator.id,
    reconciled,
    execution: {
      kind: "worker" as const,
      name: "MergeEntity" as const,
    },
  };
}

async function assertOperationResultState(
  operation: LoadedEntityMergeOperation,
  database: AnyDatabase = db,
) {
  const source = await database.query.entities.findFirst({
    where: eq(entities.id, operation.sourceEntityId),
  });
  const destination = await database.query.entities.findFirst({
    where: eq(entities.id, operation.destinationEntityId),
  });
  const tombstone = await database.query.entityTombstones.findFirst({
    where: and(
      eq(entityTombstones.entityId, operation.sourceEntityId),
      eq(entityTombstones.newEntityId, operation.destinationEntityId),
    ),
  });

  if (source || !destination || !tombstone) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operation.operationId} does not match the current Entity merge state.`,
      operation.operationId,
    );
  }

  return destination;
}

async function performEntityMerge({
  toEntityId,
  fromEntityIds,
  operation,
}: {
  toEntityId: number;
  fromEntityIds: number[];
  operation: LoadedEntityMergeOperation | null;
}) {
  logInfo("Merging entities into {toEntityId}", {
    extra: {
      fromEntityIds,
      toEntityId,
      operationId: operation?.operationId,
    },
  });

  const [toEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, toEntityId));
  if (!toEntity) {
    if (!operation) {
      logWarn("Merge target entity not found", { extra: { toEntityId } });
      return;
    }
  }

  const mutationUser =
    operation?.approvingModerator ?? (await getAutomationModeratorUser());
  const bottleMergeManifests: ConcreteBottleMergeFinalizationManifest[] = [];
  const bottleUpdateManifests: ConcreteBottleUpdateFinalizationManifest[] = [];
  let completedOperationResult: ReturnType<typeof buildOperationResult> | null =
    null;
  let performedMutation = operation === null;

  await db.transaction(async (tx) => {
    if (operation) {
      const currentOperation = await loadEntityMergeOperation({
        operationId: operation.operationId,
        approvingModeratorId: operation.approvingModerator.id,
        database: tx,
        lock: true,
      });
      if (currentOperation.status === "failed") {
        return;
      }
      if (currentOperation.status === "applied") {
        completedOperationResult = currentOperation.result;
        return;
      }
      if (
        currentOperation.sourceEntityId !== fromEntityIds[0] ||
        currentOperation.destinationEntityId !== toEntityId ||
        fromEntityIds.length !== 1
      ) {
        throw new EntityMergeOperationExecutionError(
          `Bottle operation ${currentOperation.operationId} changed before execution.`,
          currentOperation.operationId,
        );
      }
      const [sourceEntity] = await tx
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, currentOperation.sourceEntityId))
        .limit(1);
      if (!sourceEntity) {
        let reconciledDestination: typeof entities.$inferSelect;
        try {
          reconciledDestination = await assertOperationResultState(
            currentOperation,
            tx,
          );
        } catch (error) {
          throw new EntityMergeOperationExecutionError(
            `Source Entity ${currentOperation.sourceEntityId} was not found.`,
            currentOperation.operationId,
            { cause: error },
          );
        }

        completedOperationResult = buildOperationResult(
          currentOperation,
          true,
          sortedUniqueEntityRoles([reconciledDestination.type]),
        );
        await markEntityMergeOperationApplied({
          database: tx,
          operationId: currentOperation.operationId,
          result: completedOperationResult,
        });
        return;
      }
      if (
        !(await revalidateApplyingEntityMergeOperation({
          operationId: currentOperation.operationId,
          database: tx,
        }))
      ) {
        return;
      }

      performedMutation = true;
    }
    if (!toEntity) {
      throw new EntityMergeOperationExecutionError(
        `Destination Entity ${toEntityId} was not found.`,
        operation?.operationId ?? 0,
      );
    }

    const actor = operation
      ? await getUserActorForDatabase(tx, operation.approvingModerator)
      : await getPeatedSystemActorForDatabase(tx);
    const mergeEntityRows = await tx
      .select({ id: entities.id, type: entities.type })
      .from(entities)
      .where(inArray(entities.id, [toEntityId, ...fromEntityIds]))
      .orderBy(asc(entities.id))
      .for("update");
    const destinationRolesBefore = sortedUniqueEntityRoles([
      mergeEntityRows.find(({ id }) => id === toEntityId)?.type ?? [],
    ]);
    const destinationRolesAfter = sortedUniqueEntityRoles(
      mergeEntityRows.map(({ type }) => type),
    );
    const destinationRolesChanged =
      destinationRolesBefore.length !== destinationRolesAfter.length ||
      destinationRolesBefore.some(
        (role, index) => role !== destinationRolesAfter[index],
      );
    if (destinationRolesChanged) {
      await tx
        .update(entities)
        .set({ type: destinationRolesAfter })
        .where(eq(entities.id, toEntityId));
    }

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
          user: mutationUser,
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

    if (operation) {
      const sourceEntities = await tx
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .where(inArray(entities.id, fromEntityIds));
      await tx.insert(changes).values([
        ...sourceEntities.map((sourceEntity) => ({
          objectType: "entity" as const,
          objectId: sourceEntity.id,
          actorId: actor.id,
          displayName: sourceEntity.name,
          type: "delete" as const,
          data: {
            operationId: operation.operationId,
            updateScope: "entity_merge",
            destinationEntityId: toEntity.id,
            execution: {
              kind: "worker",
              name: "MergeEntity",
            },
          },
        })),
        {
          objectType: "entity" as const,
          objectId: toEntity.id,
          actorId: actor.id,
          displayName: toEntity.name,
          type: "update" as const,
          data: {
            operationId: operation.operationId,
            updateScope: "entity_merge",
            sourceEntityIds: fromEntityIds,
            destinationRoles: destinationRolesAfter,
            ...(destinationRolesChanged
              ? {
                  roleChange: {
                    before: destinationRolesBefore,
                    after: destinationRolesAfter,
                  },
                }
              : {}),
            execution: {
              kind: "worker",
              name: "MergeEntity",
            },
          },
        },
      ]);
    }

    await tx.delete(entities).where(inArray(entities.id, fromEntityIds));

    if (operation) {
      const remainingSource = await tx
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, operation.sourceEntityId))
        .limit(1);
      const destination = await tx
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, operation.destinationEntityId))
        .limit(1);
      const tombstone = await tx
        .select({ entityId: entityTombstones.entityId })
        .from(entityTombstones)
        .where(
          and(
            eq(entityTombstones.entityId, operation.sourceEntityId),
            eq(entityTombstones.newEntityId, operation.destinationEntityId),
          ),
        )
        .limit(1);
      if (remainingSource.length || !destination.length || !tombstone.length) {
        throw new EntityMergeOperationExecutionError(
          `Bottle operation ${operation.operationId} could not verify the Entity merge result.`,
          operation.operationId,
        );
      }

      completedOperationResult = buildOperationResult(
        operation,
        false,
        destinationRolesAfter,
      );
      await markEntityMergeOperationApplied({
        database: tx,
        operationId: operation.operationId,
        result: completedOperationResult,
      });
    }
  });

  if (operation && !performedMutation) {
    return completedOperationResult;
  }

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

  return completedOperationResult;
}

export default async function mergeEntity(rawInput: unknown) {
  const input = EntityMergeJobInputSchema.parse(rawInput);
  if (!isOperationEntityMergeJobInput(input)) {
    return await performEntityMerge({
      toEntityId: input.toEntityId,
      fromEntityIds: input.fromEntityIds,
      operation: null,
    });
  }

  let operation: LoadedEntityMergeOperation;
  try {
    operation = await loadEntityMergeOperation({
      operationId: input.operationId,
      approvingModeratorId: input.approvingModeratorId,
    });
    if (operation.status === "failed") {
      logWarn("Entity merge operation is already failed", {
        extra: { operationId: operation.operationId },
      });
      return;
    }
    if (operation.status === "applied") {
      return operation.result;
    }

    return await performEntityMerge({
      toEntityId: operation.destinationEntityId,
      fromEntityIds: [operation.sourceEntityId],
      operation,
    });
  } catch (error) {
    try {
      await markEntityMergeOperationFailed({
        operationId: input.operationId,
        approvingModeratorId: input.approvingModeratorId,
        error,
      });
    } catch (statusError) {
      logError(statusError, {
        extra: {
          operationId: input.operationId,
          phase: "record_entity_merge_failure",
        },
      });
    }
    throw error;
  }
}
