/**
 * Owns legacy Bottle alias evidence writes for the staged catalog migration.
 * Runtime alias lookup and assignment must not import this module.
 */
import type { AnyTransaction } from "@peated/server/db";
import type { BottleAlias } from "@peated/server/db/schema";
import { bottleAliases } from "@peated/server/db/schema";
import {
  BottleAliasBottleInactiveError,
  BottleAliasBottleNotFoundError,
  BottleAliasBottleRetiredError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { eq, sql } from "drizzle-orm";

export type CatalogMigrationBottleAliasIdentitySnapshot = Pick<
  BottleAlias,
  "name" | "bottleId" | "releaseId" | "targetId" | "ignored"
>;

export class CatalogMigrationBottleAliasIdentityChangedError extends Error {
  constructor(readonly aliasName: string) {
    super(`Bottle alias identity changed during migration (${aliasName}).`);
    this.name = "CatalogMigrationBottleAliasIdentityChangedError";
  }
}

export type CatalogMigrationBottleAliasConflictCode =
  | "another_bottle"
  | "canonical_metadata"
  | "legacy_release";

export type CatalogMigrationBottleAliasConflictSnapshot = Pick<
  BottleAlias,
  | "name"
  | "bottleId"
  | "releaseId"
  | "targetId"
  | "ignored"
  | "assignmentSource"
  | "assignedByActorId"
>;

export class CatalogMigrationBottleAliasConflictError extends Error {
  constructor(
    readonly code: CatalogMigrationBottleAliasConflictCode,
    readonly alias: CatalogMigrationBottleAliasConflictSnapshot,
    readonly conflictingBottleId: number | null,
  ) {
    super(`Cannot reserve migrated Bottle alias "${alias.name}": ${code}.`);
    this.name = "CatalogMigrationBottleAliasConflictError";
  }
}

function assertBottleAliasIdentitySnapshot(
  lockedAlias: CatalogMigrationBottleAliasIdentitySnapshot | undefined,
  snapshot: CatalogMigrationBottleAliasIdentitySnapshot,
): asserts lockedAlias is CatalogMigrationBottleAliasIdentitySnapshot {
  if (
    !lockedAlias ||
    lockedAlias.name !== snapshot.name ||
    lockedAlias.bottleId !== snapshot.bottleId ||
    lockedAlias.releaseId !== snapshot.releaseId ||
    lockedAlias.targetId !== snapshot.targetId ||
    lockedAlias.ignored !== snapshot.ignored
  ) {
    throw new CatalogMigrationBottleAliasIdentityChangedError(snapshot.name);
  }
}

async function lockBottleAliasIdentitySnapshotInTransaction(
  tx: AnyTransaction,
  snapshot: CatalogMigrationBottleAliasIdentitySnapshot,
): Promise<void> {
  const [lockedAlias] = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(eq(bottleAliases.name, snapshot.name))
    .limit(1)
    .for("update");
  assertBottleAliasIdentitySnapshot(lockedAlias, snapshot);
}

/** Retains a target-evidence writer until the target-era migration is replaced. */
export async function backfillLegacyBottleAliasTargetInTransaction(
  tx: AnyTransaction,
  snapshot: CatalogMigrationBottleAliasIdentitySnapshot,
  targetId: number,
): Promise<"updated" | "reused"> {
  await lockBottleAliasIdentitySnapshotInTransaction(tx, snapshot);
  if (snapshot.targetId === targetId) return "reused";
  if (snapshot.targetId !== null) {
    throw new TypeError(
      `Legacy Bottle alias ${snapshot.name} already has another target.`,
    );
  }

  await tx
    .update(bottleAliases)
    .set({ targetId })
    .where(eq(bottleAliases.name, snapshot.name));
  return "updated";
}

async function lockActiveBottleInTransaction(
  tx: AnyTransaction,
  bottleId: number,
) {
  try {
    await resolveActiveBottleIds(tx, [bottleId], { lock: "update" });
  } catch (error) {
    if (!(error instanceof ActiveBottleSelectionError)) throw error;
    if (error.reason === "missing") {
      throw new BottleAliasBottleNotFoundError(error.bottleId);
    }
    if (error.reason === "bottle_retired") {
      throw new BottleAliasBottleRetiredError(
        error.bottleId,
        error.replacementBottleId,
      );
    }
    throw new BottleAliasBottleInactiveError(error.bottleId, error.reason);
  }
}

export type LegacyPromotionCanonicalAliasInput = {
  name: string;
  promotedBottleId: number;
  targetId: number;
  legacyBottleId: number;
  legacyReleaseId: number;
  assignedByActorId: number;
};

/**
 * Preserves the target-era promotion behavior until the one-shot migration
 * replaces it. This helper must not be used by runtime alias workflows.
 */
export async function reserveLegacyPromotionCanonicalAliasInTransaction(
  tx: AnyTransaction,
  input: LegacyPromotionCanonicalAliasInput,
): Promise<{ changed: boolean }> {
  await lockActiveBottleInTransaction(tx, input.promotedBottleId);
  const name = input.name.trim();
  const [existingAlias] = await tx
    .select()
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
    .limit(1)
    .for("update");

  const matchesLegacyIdentity =
    existingAlias?.bottleId === input.legacyBottleId &&
    existingAlias.releaseId === input.legacyReleaseId;
  const matchesPromotedIdentity =
    existingAlias?.bottleId === input.promotedBottleId &&
    existingAlias.releaseId === null;
  const isUnresolved =
    existingAlias?.bottleId === null && existingAlias.releaseId === null;
  if (
    existingAlias &&
    ((!matchesLegacyIdentity && !matchesPromotedIdentity && !isUnresolved) ||
      (existingAlias.targetId !== null &&
        existingAlias.targetId !== input.targetId))
  ) {
    throw new CatalogMigrationBottleAliasConflictError(
      existingAlias.releaseId !== null && !matchesLegacyIdentity
        ? "legacy_release"
        : existingAlias.bottleId !== input.promotedBottleId
          ? "another_bottle"
          : "canonical_metadata",
      existingAlias,
      existingAlias.bottleId,
    );
  }

  if (!existingAlias) {
    const [insertedAlias] = await tx
      .insert(bottleAliases)
      .values({
        name,
        bottleId: input.promotedBottleId,
        releaseId: null,
        targetId: input.targetId,
        ignored: false,
        assignmentSource: "canonical",
        assignedByActorId: input.assignedByActorId,
      })
      .returning();
    if (!insertedAlias) throw new FailedToSaveBottleAliasError();
    return { changed: true };
  }

  const isCanonical =
    existingAlias.name === name &&
    existingAlias.bottleId === input.promotedBottleId &&
    existingAlias.releaseId === null &&
    existingAlias.targetId === input.targetId &&
    existingAlias.ignored === false &&
    existingAlias.assignmentSource === "canonical" &&
    existingAlias.assignedByActorId === input.assignedByActorId;
  if (isCanonical) return { changed: false };

  const [updatedAlias] = await tx
    .update(bottleAliases)
    .set({
      name,
      bottleId: input.promotedBottleId,
      releaseId: null,
      targetId: input.targetId,
      ignored: false,
      assignmentSource: "canonical",
      assignedByActorId: input.assignedByActorId,
    })
    .where(eq(bottleAliases.name, existingAlias.name))
    .returning();
  if (!updatedAlias) throw new FailedToSaveBottleAliasError();
  return { changed: true };
}
