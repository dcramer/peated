/**
 * Owns CatalogTarget resolution and assignment. Generic intent remains generic,
 * while measured legacy pairs resolve only through staged migration mappings.
 */
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  bottleGroups,
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { readExactBottleMergePromotionHistory } from "@peated/server/lib/exactBottleMergePromotionMetadata";
import { logInfo } from "@peated/server/lib/log";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";

export type CatalogTargetIdentity =
  | { targetId: number }
  | { bottleId: number }
  | { groupId: number };

export type CatalogTargetResolutionErrorCode =
  | "CATALOG_TARGET_NOT_FOUND"
  | "CATALOG_TARGET_RETIRED"
  | "CATALOG_TARGET_INVALID_MAPPING"
  | "CATALOG_TARGET_INTEGRITY_MISMATCH";

export abstract class CatalogTargetResolutionError extends Error {
  protected constructor(
    readonly code: CatalogTargetResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CatalogTargetNotFoundError extends CatalogTargetResolutionError {
  constructor(readonly identity: CatalogTargetIdentity) {
    super(
      "CATALOG_TARGET_NOT_FOUND",
      `Catalog target not found (${formatIdentity(identity)}).`,
    );
  }
}

export type RetiredCatalogTargetReplacement =
  | { kind: "group"; groupId: number }
  | { kind: "bottle"; bottleId: number };

export class CatalogTargetRetiredError extends CatalogTargetResolutionError {
  constructor(
    readonly identity: CatalogTargetIdentity,
    readonly replacement: RetiredCatalogTargetReplacement | null,
  ) {
    super(
      "CATALOG_TARGET_RETIRED",
      `Catalog target is retired (${formatIdentity(identity)}).`,
    );
  }
}

export class CatalogTargetInvalidMappingError extends CatalogTargetResolutionError {
  constructor(
    readonly bottleId: number,
    readonly releaseId: number | null,
    readonly reason: string,
  ) {
    super(
      "CATALOG_TARGET_INVALID_MAPPING",
      `Legacy catalog target mapping is invalid (${bottleId}, ${releaseId ?? "null"}): ${reason}.`,
    );
  }
}

export type StagedTargetlessCatalogMappingReason =
  | "LEGACY_PARENT_WITHOUT_GROUP"
  | "RELEASE_WITHOUT_COMPLETED_PROMOTION";

export type StagedTargetlessCatalogAssignment = LegacyCatalogTargetReference & {
  stagedReason: StagedTargetlessCatalogMappingReason;
};

class StagedTargetlessCatalogMappingError extends CatalogTargetInvalidMappingError {
  constructor(
    bottleId: number,
    releaseId: number | null,
    readonly stagedReason: StagedTargetlessCatalogMappingReason,
    reason: string,
  ) {
    super(bottleId, releaseId, reason);
  }
}

/** Identifies only migration states that may temporarily retain a null target. */
export function isStagedTargetlessCatalogMappingError(error: unknown): boolean {
  return (
    error instanceof StagedTargetlessCatalogMappingError &&
    (error.stagedReason === "LEGACY_PARENT_WITHOUT_GROUP" ||
      error.stagedReason === "RELEASE_WITHOUT_COMPLETED_PROMOTION")
  );
}

export function getStagedTargetlessCatalogMappingReason(
  error: unknown,
): StagedTargetlessCatalogMappingReason | null {
  return error instanceof StagedTargetlessCatalogMappingError
    ? error.stagedReason
    : null;
}

export class CatalogTargetIntegrityMismatchError extends CatalogTargetResolutionError {
  constructor(
    readonly identity: CatalogTargetIdentity,
    readonly reason: string,
  ) {
    super(
      "CATALOG_TARGET_INTEGRITY_MISMATCH",
      `Catalog target integrity mismatch (${formatIdentity(identity)}): ${reason}.`,
    );
  }
}

export type LegacyCatalogTargetReference = {
  bottleId: number;
  releaseId: number | null;
};

export type CatalogTargetOperationContext = {
  caller: string;
  operation: string;
};

export type CatalogTargetAssignmentIntent =
  | { kind: "target"; targetId: number }
  | { kind: "bottle"; bottleId: number }
  | { kind: "group"; groupId: number }
  | ({
      kind: "legacy";
      context: CatalogTargetOperationContext;
    } & LegacyCatalogTargetReference);

export type CatalogTargetAssignmentDescriptor = {
  targetId: number;
  groupId: number;
  bottleId: number | null;
};

export type CatalogTargetConsumerIdentity =
  | { bottleId: number; releaseId: number | null }
  | { bottleId: null; releaseId: null };

export type CatalogTargetConsumerAssignment = {
  target: CatalogTargetAssignmentDescriptor;
  consumerIdentity: CatalogTargetConsumerIdentity;
};

async function assertCatalogTargetAssignmentDescriptor(
  database: AnyDatabase,
  target: CatalogTargetAssignmentDescriptor,
): Promise<void> {
  const resolved = await resolveCatalogTargetForAssignment(
    { kind: "target", targetId: target.targetId },
    database,
  );
  if (
    resolved.groupId !== target.groupId ||
    resolved.bottleId !== target.bottleId
  ) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.targetId },
      "the supplied assignment target descriptor changed before use",
    );
  }
}

/**
 * Locks and revalidates a resolved assignment descriptor. Callers composing
 * with the concrete Bottle mutation lifecycle acquire its group lock first.
 */
export async function lockCatalogTargetAssignmentDescriptorInTransaction(
  tx: AnyTransaction,
  target: CatalogTargetAssignmentDescriptor,
  { composition }: { composition?: "concrete_bottle_mutation" } = {},
) {
  if (composition === "concrete_bottle_mutation" || target.bottleId === null) {
    await tx
      .select({ id: bottleGroups.id })
      .from(bottleGroups)
      .where(eq(bottleGroups.id, target.groupId))
      .limit(1)
      .for("update");
  }
  if (target.bottleId !== null) {
    await tx
      .select({ id: bottles.id })
      .from(bottles)
      .where(eq(bottles.id, target.bottleId))
      .limit(1)
      .for("update");
  }
  await tx
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(eq(catalogTargets.id, target.targetId))
    .limit(1)
    .for("update");

  await assertCatalogTargetAssignmentDescriptor(tx, target);
}

function assignmentDescriptorsMatch(
  left: CatalogTargetAssignmentDescriptor,
  right: CatalogTargetAssignmentDescriptor,
) {
  return (
    left.targetId === right.targetId &&
    left.groupId === right.groupId &&
    left.bottleId === right.bottleId
  );
}

/**
 * Locks one authoritative target together with its retained consumer
 * projection. Exact targets fast-path their concrete `{ bottleId, null }`
 * projection, while promoted exact targets and generic targets may carry a
 * measured legacy pair. A retained pair is resolved before and again after the
 * target lock so drift cannot commit as a mixed assignment.
 */
export async function lockCatalogTargetConsumerAssignmentInTransaction(
  tx: AnyTransaction,
  assignment: CatalogTargetConsumerAssignment,
  context: CatalogTargetOperationContext,
): Promise<void> {
  const { target, consumerIdentity } = assignment;
  if (
    target.bottleId !== null &&
    consumerIdentity.bottleId === target.bottleId &&
    consumerIdentity.releaseId === null
  ) {
    await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
    return;
  }

  if (consumerIdentity.bottleId === null) {
    if (target.bottleId !== null) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId: target.targetId },
        "the exact target is missing its retained Bottle projection",
      );
    }
    await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
    return;
  }

  const resolveRetainedPair = () =>
    resolveCatalogTargetForAssignment(
      {
        kind: "legacy",
        bottleId: consumerIdentity.bottleId!,
        releaseId: consumerIdentity.releaseId,
        context,
      },
      tx,
    );
  const beforeLock = await resolveRetainedPair();
  if (!assignmentDescriptorsMatch(beforeLock, target)) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.targetId },
      "the retained Bottle pair does not resolve to its target",
    );
  }

  await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
  const afterLock = await resolveRetainedPair();
  if (!assignmentDescriptorsMatch(afterLock, target)) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.targetId },
      "the retained Bottle pair changed while locking its target",
    );
  }
}

/**
 * Locks a descriptor set in the global group, Bottle, then target hierarchy.
 * Required additional Bottles join the sorted Bottle layer without becoming
 * target descriptors. Every descriptor is revalidated after all locks exist.
 */
export async function lockCatalogTargetAssignmentDescriptorsInTransaction(
  tx: AnyTransaction,
  descriptors: CatalogTargetAssignmentDescriptor[],
  {
    requiredAdditionalBottleIds = [],
  }: { requiredAdditionalBottleIds?: number[] } = {},
): Promise<void> {
  const uniqueDescriptors = [
    ...new Map(
      descriptors.map((descriptor) => [
        `${descriptor.targetId}:${descriptor.groupId}:${descriptor.bottleId ?? "null"}`,
        descriptor,
      ]),
    ).values(),
  ];
  const groupIds = [
    ...new Set(uniqueDescriptors.map(({ groupId }) => groupId)),
  ].sort((a, b) => a - b);
  const bottleIds = [
    ...new Set([
      ...requiredAdditionalBottleIds,
      ...uniqueDescriptors.flatMap(({ bottleId }) =>
        bottleId === null ? [] : [bottleId],
      ),
    ]),
  ].sort((a, b) => a - b);
  const targetIds = [
    ...new Set(uniqueDescriptors.map(({ targetId }) => targetId)),
  ].sort((a, b) => a - b);

  if (groupIds.length) {
    await tx
      .select({ id: bottleGroups.id })
      .from(bottleGroups)
      .where(inArray(bottleGroups.id, groupIds))
      .orderBy(asc(bottleGroups.id))
      .for("update");
  }
  if (bottleIds.length) {
    const lockedBottles = await tx
      .select({ id: bottles.id })
      .from(bottles)
      .where(inArray(bottles.id, bottleIds))
      .orderBy(asc(bottles.id))
      .for("update");
    const lockedBottleIds = new Set(lockedBottles.map(({ id }) => id));
    const missingRequiredBottleId = requiredAdditionalBottleIds.find(
      (bottleId) => !lockedBottleIds.has(bottleId),
    );
    if (missingRequiredBottleId !== undefined) {
      throw new CatalogTargetNotFoundError({
        bottleId: missingRequiredBottleId,
      });
    }
  }
  if (targetIds.length) {
    await tx
      .select({ id: catalogTargets.id })
      .from(catalogTargets)
      .where(inArray(catalogTargets.id, targetIds))
      .orderBy(asc(catalogTargets.id))
      .for("update");
  }

  for (const descriptor of uniqueDescriptors) {
    await assertCatalogTargetAssignmentDescriptor(tx, descriptor);
  }
}

/**
 * Serializes an explicit staged legacy decision without taking target locks.
 * If grouping or promotion completed first, callers must restart from a fresh
 * target decision instead of committing stale targetless compatibility.
 */
export async function lockStagedTargetlessCatalogAssignmentInTransaction(
  tx: AnyTransaction,
  expected: StagedTargetlessCatalogAssignment,
): Promise<void> {
  const [parent] = await tx
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.id, expected.bottleId))
    .limit(1)
    .for("update");
  if (!parent) {
    throw new Error("Staged legacy CatalogTarget parent changed before use.");
  }

  if (expected.releaseId !== null) {
    const [release] = await tx
      .select({ bottleId: bottleReleases.bottleId })
      .from(bottleReleases)
      .where(eq(bottleReleases.id, expected.releaseId))
      .limit(1)
      .for("update");
    if (!release || release.bottleId !== expected.bottleId) {
      throw new Error(
        "Staged legacy CatalogTarget release changed before use.",
      );
    }

    // The release row serializes a missing promotion insert through its FK;
    // an existing promotion row is then held through the caller transaction.
    await tx
      .select({ releaseId: bottleReleasePromotions.releaseId })
      .from(bottleReleasePromotions)
      .where(eq(bottleReleasePromotions.releaseId, expected.releaseId))
      .limit(1)
      .for("update");
  }

  try {
    await resolveCatalogTargetForAssignment(
      {
        kind: "legacy",
        bottleId: expected.bottleId,
        releaseId: expected.releaseId,
        context: {
          caller: "catalogTargets",
          operation: "revalidateStagedTargetlessAssignment",
        },
      },
      tx,
    );
  } catch (error) {
    if (
      getStagedTargetlessCatalogMappingReason(error) === expected.stagedReason
    ) {
      return;
    }
    throw error;
  }

  throw new Error(
    "Staged legacy CatalogTarget assignment changed before targetless use.",
  );
}

type LegacyCatalogTargetAccess = "read" | "write";

function formatIdentity(identity: CatalogTargetIdentity): string {
  if ("targetId" in identity) return `targetId=${identity.targetId}`;
  if ("bottleId" in identity) return `bottleId=${identity.bottleId}`;
  return `groupId=${identity.groupId}`;
}

function assertOperationContext(context: CatalogTargetOperationContext): void {
  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Catalog target compatibility context requires caller and operation.",
    );
  }
}

function recordLegacyCatalogTargetUsage(
  reference: LegacyCatalogTargetReference,
  context: CatalogTargetOperationContext,
  access: LegacyCatalogTargetAccess,
): void {
  assertOperationContext(context);
  logInfo(`Legacy catalog target compatibility ${access}`, {
    extra: {
      event: "catalog_target.compatibility",
      access,
      caller: context.caller,
      operation: context.operation,
      bottleId: reference.bottleId,
      releaseId: reference.releaseId,
    },
  });
}

async function queryCatalogTargetAssignment(
  database: AnyDatabase,
  where: SQL<unknown>,
) {
  return await database.query.catalogTargets.findFirst({
    where,
    columns: {
      id: true,
      groupId: true,
      bottleId: true,
    },
    with: {
      group: {
        columns: { id: true },
      },
      bottle: {
        columns: {
          id: true,
          groupId: true,
        },
      },
    },
  });
}

type AssignmentCatalogTarget = NonNullable<
  Awaited<ReturnType<typeof queryCatalogTargetAssignment>>
>;

type CatalogTargetIntegrityProjection = AssignmentCatalogTarget;
type CatalogTargetQuery<T extends CatalogTargetIntegrityProjection> = (
  database: AnyDatabase,
  where: SQL<unknown>,
) => Promise<T | undefined>;

function assertGroupNotRetired(
  groupId: number,
  groupTombstone?: { newGroupId: number },
): void {
  if (groupTombstone) {
    throw new CatalogTargetRetiredError(
      { groupId },
      { kind: "group", groupId: groupTombstone.newGroupId },
    );
  }
}

function assertBottleNotRetired(
  bottleId: number,
  bottleTombstone?: {
    newBottleId: number | null;
    newGroupId: number | null;
  },
): void {
  if (bottleTombstone) {
    throw new CatalogTargetRetiredError(
      { bottleId },
      bottleTombstone.newBottleId !== null
        ? { kind: "bottle", bottleId: bottleTombstone.newBottleId }
        : bottleTombstone.newGroupId !== null
          ? { kind: "group", groupId: bottleTombstone.newGroupId }
          : null,
    );
  }
}

async function throwIfGroupRetired(
  groupId: number,
  database: AnyDatabase,
): Promise<void> {
  const tombstone = await database.query.bottleGroupTombstones.findFirst({
    where: eq(bottleGroupTombstones.groupId, groupId),
  });
  assertGroupNotRetired(groupId, tombstone);
}

async function throwIfBottleRetired(
  bottleId: number,
  database: AnyDatabase,
): Promise<void> {
  const tombstone = await database.query.bottleTombstones.findFirst({
    where: eq(bottleTombstones.bottleId, bottleId),
  });
  assertBottleNotRetired(bottleId, tombstone);
}

function assertTargetIntegrity(target: CatalogTargetIntegrityProjection): void {
  if (!target.group || target.group.id !== target.groupId) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.id },
      "the hydrated group does not match the stored group id",
    );
  }

  if (target.bottleId === null) {
    if (target.bottle) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId: target.id },
        "a generic target hydrated an exact Bottle",
      );
    }
    return;
  }

  if (
    !target.bottle ||
    target.bottle.id !== target.bottleId ||
    target.bottle.groupId !== target.groupId
  ) {
    throw new CatalogTargetIntegrityMismatchError(
      { targetId: target.id },
      "the exact Bottle does not match the stored target membership",
    );
  }
}

async function assertTargetActive(
  target: CatalogTargetIntegrityProjection,
  database: AnyDatabase,
): Promise<void> {
  const [groupTombstone, bottleTombstone] = await Promise.all([
    database.query.bottleGroupTombstones.findFirst({
      where: eq(bottleGroupTombstones.groupId, target.groupId),
    }),
    target.bottleId === null
      ? undefined
      : database.query.bottleTombstones.findFirst({
          where: eq(bottleTombstones.bottleId, target.bottleId),
        }),
  ]);
  assertGroupNotRetired(target.groupId, groupTombstone);
  if (target.bottleId !== null) {
    assertBottleNotRetired(target.bottleId, bottleTombstone);
  }
}

async function findTargetByIdUsing<T extends CatalogTargetIntegrityProjection>(
  targetId: number,
  database: AnyDatabase,
  queryTarget: CatalogTargetQuery<T>,
): Promise<T> {
  const target = await queryTarget(database, eq(catalogTargets.id, targetId));
  if (!target) throw new CatalogTargetNotFoundError({ targetId });
  assertTargetIntegrity(target);
  await assertTargetActive(target, database);
  return target;
}

async function findTargetByBottleIdUsing<
  T extends CatalogTargetIntegrityProjection,
>(
  bottleId: number,
  database: AnyDatabase,
  queryTarget: CatalogTargetQuery<T>,
): Promise<T> {
  await throwIfBottleRetired(bottleId, database);
  const target = await queryTarget(
    database,
    eq(catalogTargets.bottleId, bottleId),
  );
  if (!target) throw new CatalogTargetNotFoundError({ bottleId });
  assertTargetIntegrity(target);
  await throwIfGroupRetired(target.groupId, database);
  return target;
}

async function findTargetByGroupIdUsing<
  T extends CatalogTargetIntegrityProjection,
>(
  groupId: number,
  database: AnyDatabase,
  queryTarget: CatalogTargetQuery<T>,
): Promise<T> {
  await throwIfGroupRetired(groupId, database);
  const target = await queryTarget(
    database,
    and(eq(catalogTargets.groupId, groupId), isNull(catalogTargets.bottleId))!,
  );
  if (!target) throw new CatalogTargetNotFoundError({ groupId });
  assertTargetIntegrity(target);
  return target;
}

async function findAssignmentTargetById(
  targetId: number,
  database: AnyDatabase,
): Promise<AssignmentCatalogTarget> {
  return await findTargetByIdUsing(
    targetId,
    database,
    queryCatalogTargetAssignment,
  );
}

async function findAssignmentTargetByBottleId(
  bottleId: number,
  database: AnyDatabase,
): Promise<AssignmentCatalogTarget> {
  return await findTargetByBottleIdUsing(
    bottleId,
    database,
    queryCatalogTargetAssignment,
  );
}

async function findAssignmentTargetByGroupId(
  groupId: number,
  database: AnyDatabase,
): Promise<AssignmentCatalogTarget> {
  return await findTargetByGroupIdUsing(
    groupId,
    database,
    queryCatalogTargetAssignment,
  );
}

/** Validates the durable, contiguous merge chain behind a moved promotion. */
async function promotionConvergedByExactMerges({
  metadata,
  sourceGroupId,
  destinationBottleId,
  destinationGroupId,
  database,
}: {
  metadata: unknown;
  sourceGroupId: number;
  destinationBottleId: number;
  destinationGroupId: number;
  database: AnyDatabase;
}): Promise<boolean> {
  const history = readExactBottleMergePromotionHistory(metadata);
  if (!history.length) return false;

  let expectedSourceBottleId: number | null = null;
  let expectedSourceGroupId = sourceGroupId;
  for (const event of history) {
    if (
      event.sourceGroupId !== expectedSourceGroupId ||
      (expectedSourceBottleId !== null &&
        event.sourceBottleId !== expectedSourceBottleId)
    ) {
      return false;
    }
    expectedSourceBottleId = event.destinationBottleId;
    expectedSourceGroupId = event.destinationGroupId;
  }
  if (
    expectedSourceBottleId !== destinationBottleId ||
    expectedSourceGroupId !== destinationGroupId
  ) {
    return false;
  }

  const sourceBottleIds = history.map(({ sourceBottleId }) => sourceBottleId);
  if (
    new Set(sourceBottleIds).size !== sourceBottleIds.length ||
    sourceBottleIds.includes(destinationBottleId)
  ) {
    return false;
  }
  const [tombstones, liveSources] = await Promise.all([
    database.query.bottleTombstones.findMany({
      where: inArray(bottleTombstones.bottleId, sourceBottleIds),
    }),
    database.query.bottles.findMany({
      where: inArray(bottles.id, sourceBottleIds),
      columns: { id: true },
    }),
  ]);
  return (
    liveSources.length === 0 &&
    tombstones.length === sourceBottleIds.length &&
    tombstones.every(({ newBottleId }) => newBottleId === destinationBottleId)
  );
}

type CatalogTargetLoaders<T extends CatalogTargetIntegrityProjection> = {
  byBottleId: (bottleId: number, database: AnyDatabase) => Promise<T>;
  byGroupId: (groupId: number, database: AnyDatabase) => Promise<T>;
};

/**
 * Applies the one measured legacy mapping rule for every target projection:
 * promoted releases resolve to their exact Bottle; a parent-only reference
 * resolves to the generic group target when releases exist, and otherwise to
 * the retained Bottle's exact target. Telemetry is emitted once per attempt.
 */
async function findLegacyTargetUsing<
  T extends CatalogTargetIntegrityProjection,
>(
  reference: LegacyCatalogTargetReference,
  context: CatalogTargetOperationContext,
  access: LegacyCatalogTargetAccess,
  database: AnyDatabase,
  loaders: CatalogTargetLoaders<T>,
  recordUsage = true,
): Promise<T> {
  if (recordUsage) recordLegacyCatalogTargetUsage(reference, context, access);

  if (reference.releaseId !== null) {
    const release = await database.query.bottleReleases.findFirst({
      where: (bottleReleases, { eq }) =>
        eq(bottleReleases.id, reference.releaseId as number),
      columns: {
        bottleId: true,
      },
      with: {
        bottle: {
          columns: { groupId: true },
        },
      },
    });
    if (!release || release.bottleId !== reference.bottleId) {
      throw new CatalogTargetInvalidMappingError(
        reference.bottleId,
        reference.releaseId,
        "the release does not belong to the supplied parent Bottle",
      );
    }

    const promotion = await database.query.bottleReleasePromotions.findFirst({
      where: eq(bottleReleasePromotions.releaseId, reference.releaseId),
    });
    if (
      !promotion ||
      promotion.status !== "promoted" ||
      promotion.promotedBottleId === null
    ) {
      throw new StagedTargetlessCatalogMappingError(
        reference.bottleId,
        reference.releaseId,
        "RELEASE_WITHOUT_COMPLETED_PROMOTION",
        "the release does not have a completed promotion mapping",
      );
    }

    let target: T;
    try {
      target = await loaders.byBottleId(promotion.promotedBottleId, database);
    } catch (error) {
      if (!(error instanceof CatalogTargetNotFoundError)) throw error;
      throw new CatalogTargetIntegrityMismatchError(
        { bottleId: promotion.promotedBottleId },
        "the promoted Bottle has no exact target",
      );
    }

    if (
      release.bottle?.groupId !== null &&
      release.bottle?.groupId !== undefined &&
      release.bottle.groupId !== target.groupId
    ) {
      const convergedByExactMerge = await promotionConvergedByExactMerges({
        metadata: promotion.auditMetadata,
        sourceGroupId: release.bottle.groupId,
        destinationBottleId: promotion.promotedBottleId,
        destinationGroupId: target.groupId,
        database,
      });
      if (!convergedByExactMerge) {
        throw new CatalogTargetIntegrityMismatchError(
          { targetId: target.id },
          "the promoted Bottle belongs to a different group than the legacy parent",
        );
      }
    }

    return target;
  }

  const parent = await database.query.bottles.findFirst({
    where: eq(bottles.id, reference.bottleId),
    columns: {
      id: true,
      groupId: true,
    },
    with: {
      releases: {
        columns: { id: true },
      },
    },
  });
  if (!parent) {
    await throwIfBottleRetired(reference.bottleId, database);
    throw new CatalogTargetNotFoundError({ bottleId: reference.bottleId });
  }
  if (parent.groupId === null) {
    throw new StagedTargetlessCatalogMappingError(
      reference.bottleId,
      null,
      "LEGACY_PARENT_WITHOUT_GROUP",
      "the legacy parent has not been assigned to a BottleGroup",
    );
  }

  try {
    return parent.releases.length > 0
      ? await loaders.byGroupId(parent.groupId, database)
      : await loaders.byBottleId(parent.id, database);
  } catch (error) {
    if (!(error instanceof CatalogTargetNotFoundError)) throw error;
    throw new CatalogTargetInvalidMappingError(
      reference.bottleId,
      null,
      parent.releases.length > 0
        ? "the legacy parent group has no generic target"
        : "the retained Bottle has no exact target",
    );
  }
}

async function findAssignmentLegacyTarget(
  reference: LegacyCatalogTargetReference,
  context: CatalogTargetOperationContext,
  database: AnyDatabase,
  access: LegacyCatalogTargetAccess = "write",
  recordUsage = true,
): Promise<AssignmentCatalogTarget> {
  return await findLegacyTargetUsing(
    reference,
    context,
    access,
    database,
    {
      byBottleId: findAssignmentTargetByBottleId,
      byGroupId: findAssignmentTargetByGroupId,
    },
    recordUsage,
  );
}

export type LegacyCatalogTargetReadFilter = {
  bottleId?: number;
  releaseId?: number;
};

/**
 * Translates retained list filters through one measured compatibility owner.
 * Task 9.7 removes this adapter with Bottle/Release query input.
 */
export async function resolveLegacyCatalogTargetFilterForRead(
  filter: LegacyCatalogTargetReadFilter,
  context: CatalogTargetOperationContext,
  database: AnyDatabase = db,
): Promise<CatalogTargetAssignmentDescriptor | null> {
  assertOperationContext(context);
  if (filter.bottleId === undefined && filter.releaseId === undefined) {
    throw new TypeError("A legacy Bottle or release filter is required.");
  }

  let resolvedBottleId = filter.bottleId ?? null;
  let outcome: "resolved" | "not_found" | "mismatched_pair" | "error" = "error";
  try {
    if (filter.releaseId !== undefined) {
      const release = await database.query.bottleReleases.findFirst({
        where: eq(bottleReleases.id, filter.releaseId),
        columns: { bottleId: true },
      });
      if (!release) {
        outcome = "not_found";
        return null;
      }
      if (
        filter.bottleId !== undefined &&
        filter.bottleId !== release.bottleId
      ) {
        outcome = "mismatched_pair";
        return null;
      }
      resolvedBottleId = release.bottleId;
    }

    try {
      const target = await findAssignmentLegacyTarget(
        {
          bottleId: resolvedBottleId!,
          releaseId: filter.releaseId ?? null,
        },
        context,
        database,
        "read",
        false,
      );
      outcome = "resolved";
      return {
        targetId: target.id,
        groupId: target.groupId,
        bottleId: target.bottleId,
      };
    } catch (error) {
      if (error instanceof CatalogTargetNotFoundError) {
        outcome = "not_found";
        return null;
      }
      throw error;
    }
  } finally {
    logInfo("Legacy catalog target filter compatibility", {
      extra: {
        event: "catalog_target.compatibility",
        access: "read",
        caller: context.caller,
        operation: context.operation,
        bottleId: resolvedBottleId,
        releaseId: filter.releaseId ?? null,
        outcome,
      },
    });
  }
}

/**
 * Resolves an assignment descriptor whose targetId is the durable identity.
 * Callers may persist it or use the descriptor for validation and routing;
 * groupId and bottleId are validated scope, not alternate identity inputs.
 */
export async function resolveCatalogTargetForAssignment(
  intent: CatalogTargetAssignmentIntent,
  database: AnyDatabase = db,
): Promise<CatalogTargetAssignmentDescriptor> {
  let target: AssignmentCatalogTarget;
  switch (intent.kind) {
    case "target":
      target = await findAssignmentTargetById(intent.targetId, database);
      break;
    case "bottle":
      target = await findAssignmentTargetByBottleId(intent.bottleId, database);
      break;
    case "group":
      target = await findAssignmentTargetByGroupId(intent.groupId, database);
      break;
    case "legacy":
      target = await findAssignmentLegacyTarget(
        intent,
        intent.context,
        database,
      );
      break;
  }

  return {
    targetId: target.id,
    groupId: target.groupId,
    bottleId: target.bottleId,
  };
}
