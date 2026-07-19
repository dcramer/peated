/**
 * Locks and validates the promoted CatalogTarget graph for one legacy parent.
 * Consumer backfills share this boundary so pair semantics and lock order have
 * one owner throughout the migration.
 */
import { asc, eq, inArray } from "drizzle-orm";
import type { AnyTransaction } from "../db";
import { bottleReleasePromotions, bottleReleases, bottles } from "../db/schema";
import {
  CatalogTargetResolutionError,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
} from "./catalogTargets";

export type CatalogMigrationFamilyTargetErrorCode =
  | "parent_not_found"
  | "target_resolution_failed"
  | "target_graph_changed";

export class CatalogMigrationFamilyTargetError extends Error {
  constructor(
    readonly code: CatalogMigrationFamilyTargetErrorCode,
    readonly parentId: number,
    readonly releaseId: number | null,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(
      `Catalog migration family ${code} for parent ${parentId}${releaseId === null ? "" : ` release ${releaseId}`}.`,
      options,
    );
    this.name = "CatalogMigrationFamilyTargetError";
  }
}

export type LockedCatalogMigrationFamilyTargets = {
  releaseIds: number[];
  targetByReleaseId: ReadonlyMap<
    number | null,
    CatalogTargetAssignmentDescriptor
  >;
};

function errorDetails(error: unknown): Record<string, unknown> {
  return {
    reason: error instanceof Error ? error.message : String(error),
  };
}

function descriptorsMatch(
  left: CatalogTargetAssignmentDescriptor,
  right: CatalogTargetAssignmentDescriptor,
): boolean {
  return (
    left.targetId === right.targetId &&
    left.groupId === right.groupId &&
    left.bottleId === right.bottleId
  );
}

async function resolveLegacyTarget(
  tx: AnyTransaction,
  parentId: number,
  releaseId: number | null,
  caller: string,
  operation: string,
): Promise<CatalogTargetAssignmentDescriptor> {
  try {
    return await resolveCatalogTargetForAssignment(
      {
        kind: "legacy",
        bottleId: parentId,
        releaseId,
        context: { caller, operation },
      },
      tx,
    );
  } catch (error) {
    if (!(error instanceof CatalogTargetResolutionError)) throw error;
    throw new CatalogMigrationFamilyTargetError(
      "target_resolution_failed",
      parentId,
      releaseId,
      errorDetails(error),
      { cause: error },
    );
  }
}

async function loadParentFamilyReleaseIds(
  tx: AnyTransaction,
  parentId: number,
): Promise<number[]> {
  const [parent] = await tx
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.id, parentId))
    .limit(1);
  if (!parent) {
    throw new CatalogMigrationFamilyTargetError(
      "parent_not_found",
      parentId,
      null,
    );
  }

  return (
    await tx
      .select({ id: bottleReleases.id })
      .from(bottleReleases)
      .where(eq(bottleReleases.bottleId, parentId))
      .orderBy(asc(bottleReleases.id))
  ).map(({ id }) => id);
}

async function lockMigrationEvidence(
  tx: AnyTransaction,
  parentId: number,
  expectedReleaseIds: number[],
): Promise<void> {
  const releases = await tx
    .select({ id: bottleReleases.id })
    .from(bottleReleases)
    .where(eq(bottleReleases.bottleId, parentId))
    .orderBy(asc(bottleReleases.id))
    .for("update");
  const lockedReleaseIds = releases.map(({ id }) => id);
  if (
    lockedReleaseIds.length !== expectedReleaseIds.length ||
    lockedReleaseIds.some((id, index) => id !== expectedReleaseIds[index])
  ) {
    throw new CatalogMigrationFamilyTargetError(
      "target_graph_changed",
      parentId,
      null,
      { expectedReleaseIds, actualReleaseIds: lockedReleaseIds },
    );
  }
  if (lockedReleaseIds.length) {
    await tx
      .select({ releaseId: bottleReleasePromotions.releaseId })
      .from(bottleReleasePromotions)
      .where(inArray(bottleReleasePromotions.releaseId, lockedReleaseIds))
      .orderBy(asc(bottleReleasePromotions.releaseId))
      .for("update");
  }
}

/** Resolves, locks, and revalidates every measured pair in one parent family. */
export async function lockCatalogMigrationFamilyTargetsInTransaction(
  tx: AnyTransaction,
  parentId: number,
  { caller }: { caller: string },
): Promise<LockedCatalogMigrationFamilyTargets> {
  const releaseIds = await loadParentFamilyReleaseIds(tx, parentId);
  const familyReleaseIds = [null, ...releaseIds] as Array<number | null>;
  const optimisticTargets: CatalogTargetAssignmentDescriptor[] = [];
  for (const releaseId of familyReleaseIds) {
    optimisticTargets.push(
      await resolveLegacyTarget(
        tx,
        parentId,
        releaseId,
        caller,
        "validateParentFamily",
      ),
    );
  }

  try {
    await lockCatalogTargetAssignmentDescriptorsInTransaction(
      tx,
      optimisticTargets,
      { requiredAdditionalBottleIds: [parentId] },
    );
    await lockMigrationEvidence(tx, parentId, releaseIds);
  } catch (error) {
    if (error instanceof CatalogMigrationFamilyTargetError) throw error;
    if (!(error instanceof CatalogTargetResolutionError)) throw error;
    throw new CatalogMigrationFamilyTargetError(
      "target_graph_changed",
      parentId,
      null,
      errorDetails(error),
      { cause: error },
    );
  }

  const targetByReleaseId = new Map<
    number | null,
    CatalogTargetAssignmentDescriptor
  >();
  for (const [index, releaseId] of familyReleaseIds.entries()) {
    let lockedTarget: CatalogTargetAssignmentDescriptor;
    try {
      lockedTarget = await resolveLegacyTarget(
        tx,
        parentId,
        releaseId,
        caller,
        "revalidateParentFamily",
      );
    } catch (error) {
      if (!(error instanceof CatalogMigrationFamilyTargetError)) throw error;
      throw new CatalogMigrationFamilyTargetError(
        "target_graph_changed",
        parentId,
        releaseId,
        errorDetails(error),
        { cause: error },
      );
    }
    if (!descriptorsMatch(optimisticTargets[index]!, lockedTarget)) {
      throw new CatalogMigrationFamilyTargetError(
        "target_graph_changed",
        parentId,
        releaseId,
        { expected: optimisticTargets[index], actual: lockedTarget },
      );
    }
    targetByReleaseId.set(releaseId, lockedTarget);
  }

  return { releaseIds, targetByReleaseId };
}
