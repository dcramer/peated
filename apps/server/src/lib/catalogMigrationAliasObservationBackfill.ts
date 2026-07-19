/**
 * Backfills durable targets for legacy aliases and observations while retaining
 * their Bottle/Release references. One promoted parent family commits as a unit.
 */
import { asc, eq, inArray, or } from "drizzle-orm";
import { db, type AnyConnection, type AnyTransaction } from "../db";
import { bottleAliases, bottleObservations } from "../db/schema";
import type { CatalogMigrationAliasObservationTable } from "../schemas/catalogMigrationRun";
import {
  backfillLegacyBottleAliasTargetInTransaction,
  BottleAliasIdentityChangedError,
  type BottleAliasIdentitySnapshot,
} from "./bottleAliases";
import {
  CatalogMigrationFamilyTargetError,
  lockCatalogMigrationFamilyTargetsInTransaction,
} from "./catalogMigrationFamilyTargets";
import type { CatalogTargetAssignmentDescriptor } from "./catalogTargets";

export type CatalogMigrationAliasObservationBackfillErrorCode =
  | "parent_not_found"
  | "target_resolution_failed"
  | "target_graph_changed"
  | "target_conflict"
  | "row_changed";

export class CatalogMigrationAliasObservationBackfillError extends Error {
  constructor(
    readonly code: CatalogMigrationAliasObservationBackfillErrorCode,
    readonly parentId: number,
    readonly table: CatalogMigrationAliasObservationTable | null,
    readonly rowId: string | number | null,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(
      `Catalog migration ${code} for parent ${parentId}${table && rowId !== null ? ` ${table} ${rowId}` : ""}.`,
      options,
    );
    this.name = "CatalogMigrationAliasObservationBackfillError";
  }
}

export type CatalogMigrationAliasObservationParentResult = {
  parentId: number;
  aliasRows: number;
  aliasesUpdated: number;
  aliasesReused: number;
  observationRows: number;
  observationsUpdated: number;
  observationsReused: number;
};

type AliasPlan = {
  snapshot: BottleAliasIdentitySnapshot;
  target: CatalogTargetAssignmentDescriptor;
};

type ObservationSnapshot = Pick<
  typeof bottleObservations.$inferSelect,
  "id" | "bottleId" | "releaseId" | "targetId"
>;

type ObservationPlan = {
  snapshot: ObservationSnapshot;
  target: CatalogTargetAssignmentDescriptor;
};

function errorDetails(error: unknown): Record<string, unknown> {
  return {
    reason: error instanceof Error ? error.message : String(error),
  };
}

function rowError(
  code: CatalogMigrationAliasObservationBackfillErrorCode,
  parentId: number,
  table: CatalogMigrationAliasObservationTable,
  rowId: string | number,
  details: Record<string, unknown>,
  cause?: unknown,
): CatalogMigrationAliasObservationBackfillError {
  return new CatalogMigrationAliasObservationBackfillError(
    code,
    parentId,
    table,
    rowId,
    details,
    cause === undefined ? undefined : { cause },
  );
}

function assertTargetCompatible(
  parentId: number,
  table: CatalogMigrationAliasObservationTable,
  rowId: string | number,
  actualTargetId: number | null,
  expectedTargetId: number,
): void {
  if (actualTargetId !== null && actualTargetId !== expectedTargetId) {
    throw rowError("target_conflict", parentId, table, rowId, {
      actualTargetId,
      expectedTargetId,
    });
  }
}

async function loadAliasPlans(
  tx: AnyTransaction,
  parentId: number,
  releaseIds: number[],
  targetByReleaseId: ReadonlyMap<
    number | null,
    CatalogTargetAssignmentDescriptor
  >,
): Promise<AliasPlan[]> {
  const aliases = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(
      releaseIds.length
        ? or(
            eq(bottleAliases.bottleId, parentId),
            inArray(bottleAliases.releaseId, releaseIds),
          )
        : eq(bottleAliases.bottleId, parentId),
    )
    .orderBy(asc(bottleAliases.name));

  const plans: AliasPlan[] = [];
  for (const snapshot of aliases) {
    if (snapshot.bottleId !== parentId) {
      throw rowError(
        "target_resolution_failed",
        parentId,
        "bottle_alias",
        snapshot.name,
        {
          reason: "the retained alias Bottle does not match its release parent",
          actualBottleId: snapshot.bottleId,
          expectedBottleId: parentId,
          releaseId: snapshot.releaseId,
        },
      );
    }
    if (
      snapshot.releaseId !== null &&
      !releaseIds.includes(snapshot.releaseId)
    ) {
      throw rowError(
        "target_resolution_failed",
        parentId,
        "bottle_alias",
        snapshot.name,
        {
          reason: "the retained alias release does not belong to this parent",
          releaseId: snapshot.releaseId,
        },
      );
    }
    const target = targetByReleaseId.get(snapshot.releaseId);
    if (!target) {
      throw new Error(
        `Missing locked family target for alias ${snapshot.name}.`,
      );
    }
    assertTargetCompatible(
      parentId,
      "bottle_alias",
      snapshot.name,
      snapshot.targetId,
      target.targetId,
    );
    plans.push({ snapshot, target });
  }
  return plans;
}

async function loadObservationPlans(
  tx: AnyTransaction,
  parentId: number,
  releaseIds: number[],
  targetByReleaseId: ReadonlyMap<
    number | null,
    CatalogTargetAssignmentDescriptor
  >,
): Promise<ObservationPlan[]> {
  const observations = await tx
    .select({
      id: bottleObservations.id,
      bottleId: bottleObservations.bottleId,
      releaseId: bottleObservations.releaseId,
      targetId: bottleObservations.targetId,
    })
    .from(bottleObservations)
    .where(
      releaseIds.length
        ? or(
            eq(bottleObservations.bottleId, parentId),
            inArray(bottleObservations.releaseId, releaseIds),
          )
        : eq(bottleObservations.bottleId, parentId),
    )
    .orderBy(asc(bottleObservations.id));

  const plans: ObservationPlan[] = [];
  for (const snapshot of observations) {
    if (snapshot.bottleId !== parentId) {
      throw rowError(
        "target_resolution_failed",
        parentId,
        "bottle_observation",
        snapshot.id,
        {
          reason:
            "the retained observation Bottle does not match its release parent",
          actualBottleId: snapshot.bottleId,
          expectedBottleId: parentId,
          releaseId: snapshot.releaseId,
        },
      );
    }
    if (
      snapshot.releaseId !== null &&
      !releaseIds.includes(snapshot.releaseId)
    ) {
      throw rowError(
        "target_resolution_failed",
        parentId,
        "bottle_observation",
        snapshot.id,
        {
          reason:
            "the retained observation release does not belong to this parent",
          releaseId: snapshot.releaseId,
        },
      );
    }
    const target = targetByReleaseId.get(snapshot.releaseId);
    if (!target) {
      throw new Error(
        `Missing locked family target for observation ${snapshot.id}.`,
      );
    }
    assertTargetCompatible(
      parentId,
      "bottle_observation",
      snapshot.id,
      snapshot.targetId,
      target.targetId,
    );
    plans.push({ snapshot, target });
  }
  return plans;
}

async function backfillObservationTarget(
  tx: AnyTransaction,
  parentId: number,
  { snapshot, target }: ObservationPlan,
): Promise<"updated" | "reused"> {
  const [locked] = await tx
    .select({
      id: bottleObservations.id,
      bottleId: bottleObservations.bottleId,
      releaseId: bottleObservations.releaseId,
      targetId: bottleObservations.targetId,
    })
    .from(bottleObservations)
    .where(eq(bottleObservations.id, snapshot.id))
    .limit(1)
    .for("update");
  if (
    !locked ||
    locked.bottleId !== snapshot.bottleId ||
    locked.releaseId !== snapshot.releaseId ||
    locked.targetId !== snapshot.targetId
  ) {
    throw rowError("row_changed", parentId, "bottle_observation", snapshot.id, {
      expected: snapshot,
      actual: locked ?? null,
    });
  }
  if (snapshot.targetId === target.targetId) return "reused";

  await tx
    .update(bottleObservations)
    .set({ targetId: target.targetId })
    .where(eq(bottleObservations.id, snapshot.id));
  return "updated";
}

/** Backfills only alias and observation targets for one promoted parent family. */
export async function backfillLegacyCatalogAliasObservationsForParent(
  parentId: number,
  database: AnyConnection = db,
): Promise<CatalogMigrationAliasObservationParentResult> {
  return await database.transaction(async (tx) => {
    let family;
    try {
      family = await lockCatalogMigrationFamilyTargetsInTransaction(
        tx,
        parentId,
        { caller: "catalogMigrationAliasObservationBackfill" },
      );
    } catch (error) {
      if (!(error instanceof CatalogMigrationFamilyTargetError)) throw error;
      throw new CatalogMigrationAliasObservationBackfillError(
        error.code,
        parentId,
        null,
        error.releaseId,
        error.details,
        { cause: error },
      );
    }
    const { releaseIds, targetByReleaseId } = family;

    const aliasPlans = await loadAliasPlans(
      tx,
      parentId,
      releaseIds,
      targetByReleaseId,
    );
    const observationPlans = await loadObservationPlans(
      tx,
      parentId,
      releaseIds,
      targetByReleaseId,
    );

    let aliasesUpdated = 0;
    let aliasesReused = 0;
    for (const plan of aliasPlans) {
      try {
        const outcome = await backfillLegacyBottleAliasTargetInTransaction(
          tx,
          plan.snapshot,
          plan.target.targetId,
        );
        if (outcome === "updated") aliasesUpdated += 1;
        else aliasesReused += 1;
      } catch (error) {
        if (!(error instanceof BottleAliasIdentityChangedError)) throw error;
        throw rowError(
          "row_changed",
          parentId,
          "bottle_alias",
          plan.snapshot.name,
          errorDetails(error),
          error,
        );
      }
    }

    let observationsUpdated = 0;
    let observationsReused = 0;
    for (const plan of observationPlans) {
      const outcome = await backfillObservationTarget(tx, parentId, plan);
      if (outcome === "updated") observationsUpdated += 1;
      else observationsReused += 1;
    }

    return {
      parentId,
      aliasRows: aliasPlans.length,
      aliasesUpdated,
      aliasesReused,
      observationRows: observationPlans.length,
      observationsUpdated,
      observationsReused,
    };
  });
}
