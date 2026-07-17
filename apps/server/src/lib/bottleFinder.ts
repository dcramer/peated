import { and, eq, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleAliases, catalogTargets } from "../db/schema";
import type { BottleAliasIdentitySnapshot } from "./bottleAliases";
import {
  CatalogTargetIntegrityMismatchError,
  getStagedTargetlessCatalogMappingReason,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
  type CatalogTargetOperationContext,
  type StagedTargetlessCatalogAssignment,
} from "./catalogTargets";
import { logInfo } from "./log";

export type BottleAliasAssignmentMatch =
  | {
      kind: "target";
      alias: BottleAliasIdentitySnapshot;
      target: CatalogTargetAssignmentDescriptor;
      consumerIdentity:
        | { bottleId: number; releaseId: number | null }
        | { bottleId: null; releaseId: null };
    }
  | {
      kind: "staged_targetless";
      alias: BottleAliasIdentitySnapshot;
      stagedTargetless: StagedTargetlessCatalogAssignment;
      consumerIdentity: { bottleId: number; releaseId: number | null };
    };

async function findBottleAliasIdentitySnapshot(
  name: string,
  database: AnyDatabase,
): Promise<BottleAliasIdentitySnapshot | null> {
  const [alias] = await database
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
      ),
    )
    .limit(1);
  return alias ?? null;
}

function recordTargetlessAliasRead(
  alias: BottleAliasIdentitySnapshot & { bottleId: number },
  context: CatalogTargetOperationContext,
) {
  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Bottle alias compatibility context requires caller and operation.",
    );
  }

  logInfo("Legacy targetless Bottle alias resolution", {
    extra: {
      event: "bottle_alias.compatibility",
      access: "read",
      caller: context.caller,
      operation: context.operation,
      bottleId: alias.bottleId,
      releaseId: alias.releaseId,
      name: alias.name,
    },
  });
}

/**
 * Resolves a StorePrice ingestion alias to one assignment decision.
 * Target-backed exact aliases use their authoritative Bottle with no release.
 * Generic aliases never substitute a representative: they carry null/null when
 * no legacy pair exists, or a retained pair only after it resolves to that same
 * generic target. Targetless legacy pairs use the measured migration resolver,
 * keep that pair when it resolves, and remain targetless only for an explicitly
 * staged mapping.
 */
export async function findBottleAliasAssignment(
  name: string,
  context: CatalogTargetOperationContext,
  database: AnyDatabase = db,
): Promise<BottleAliasAssignmentMatch | null> {
  const alias = await findBottleAliasIdentitySnapshot(name, database);
  if (!alias) return null;

  if (alias.targetId !== null) {
    const target = await resolveCatalogTargetForAssignment(
      { kind: "target", targetId: alias.targetId },
      database,
    );
    if (
      target.bottleId === null &&
      alias.bottleId === null &&
      alias.releaseId !== null
    ) {
      throw new CatalogTargetIntegrityMismatchError(
        { targetId: target.targetId },
        "the generic alias retained release has no parent Bottle",
      );
    }
    if (target.bottleId === null && alias.bottleId !== null) {
      const retainedTarget = await resolveCatalogTargetForAssignment(
        {
          kind: "legacy",
          bottleId: alias.bottleId,
          releaseId: alias.releaseId,
          context,
        },
        database,
      );
      if (retainedTarget.targetId !== target.targetId) {
        throw new CatalogTargetIntegrityMismatchError(
          { targetId: target.targetId },
          "the generic alias retained pair resolves to another target",
        );
      }
    }
    return {
      kind: "target",
      alias,
      target,
      consumerIdentity:
        target.bottleId === null
          ? alias.bottleId === null
            ? { bottleId: null, releaseId: null }
            : { bottleId: alias.bottleId, releaseId: alias.releaseId }
          : { bottleId: target.bottleId, releaseId: null },
    };
  }

  if (alias.bottleId === null) return null;

  try {
    const target = await resolveCatalogTargetForAssignment(
      {
        kind: "legacy",
        bottleId: alias.bottleId,
        releaseId: alias.releaseId,
        context,
      },
      database,
    );
    return {
      kind: "target",
      alias,
      target,
      consumerIdentity: {
        bottleId: alias.bottleId,
        releaseId: alias.releaseId,
      },
    };
  } catch (error) {
    const stagedReason = getStagedTargetlessCatalogMappingReason(error);
    if (!stagedReason) throw error;
    return {
      kind: "staged_targetless",
      alias,
      stagedTargetless: {
        bottleId: alias.bottleId,
        releaseId: alias.releaseId,
        stagedReason,
      },
      consumerIdentity: {
        bottleId: alias.bottleId,
        releaseId: alias.releaseId,
      },
    };
  }
}

/**
 * Resolves exact aliases through their authoritative target, never chooses a
 * representative for generic targets, and measures targetless fallback reads.
 */
export async function findBottleTarget(
  name: string,
  context: CatalogTargetOperationContext,
  database: AnyDatabase = db,
): Promise<{
  bottleId: number;
  releaseId: number | null;
  targetId: number | null;
} | null> {
  const alias = await findBottleAliasIdentitySnapshot(name, database);
  if (!alias) return null;

  if (alias.targetId !== null) {
    const target = await database.query.catalogTargets.findFirst({
      where: eq(catalogTargets.id, alias.targetId),
      columns: { bottleId: true },
    });
    if (target?.bottleId === null || target?.bottleId === undefined)
      return null;

    return {
      bottleId: target.bottleId,
      releaseId: null,
      targetId: alias.targetId,
    };
  }

  if (alias.bottleId === null) return null;
  recordTargetlessAliasRead({ ...alias, bottleId: alias.bottleId }, context);

  return {
    bottleId: alias.bottleId,
    releaseId: alias.releaseId,
    targetId: null,
  };
}

export async function findBottleId(
  name: string,
  context: CatalogTargetOperationContext,
  database: AnyDatabase = db,
): Promise<number | null> {
  const target = await findBottleTarget(name, context, database);
  if (target?.bottleId) return target.bottleId;
  return null;
}
