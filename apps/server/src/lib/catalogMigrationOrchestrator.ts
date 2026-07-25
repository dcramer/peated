import { z } from "zod";
import { db, type AnyConnection } from "../db";
import {
  CATALOG_MIGRATION_CONSUMER_SLOTS,
  CATALOG_MIGRATION_RUN_SCHEMA_VERSION,
  CatalogMigrationRunReportSchema,
  CatalogMigrationWriteApprovalInputSchema,
  type CatalogMigrationOperationFailure,
  type CatalogMigrationRunEvidence,
  type CatalogMigrationRunFailure,
  type CatalogMigrationRunMetrics,
  type CatalogMigrationRunReport,
  type CatalogMigrationWriteApproval,
} from "../schemas/catalogMigrationRun";
import {
  backfillLegacyCatalogAliasObservationsForParent,
  CatalogMigrationAliasObservationBackfillError,
} from "./catalogMigrationAliasObservationBackfill";
import { runCatalogMigrationAudit } from "./catalogMigrationAudit";
import {
  backfillLegacyCatalogParent,
  CatalogMigrationBackfillError,
  selectLegacyCatalogParentIds,
  type CatalogMigrationParentResult,
} from "./catalogMigrationBackfill";
import {
  backfillLegacyCatalogConsumersForParent,
  CatalogMigrationConsumerBackfillError,
  type CatalogMigrationConsumerBackfillResult,
} from "./catalogMigrationConsumerBackfill";
import { loadCatalogMigrationRevisionEvidence } from "./catalogMigrationRevision";

const DryRunOptionsSchema = z.object({
  gitRevision: z.string(),
});

const WriteOptionsSchema = z.object({
  gitRevision: z.string(),
  limit: z.number().int().min(1).max(1_000).default(100),
  report: z.unknown().nullish(),
  approvedDryRun: z.unknown(),
  approval: z.unknown(),
});

export type CatalogMigrationCheckpointWriter = (
  report: CatalogMigrationRunReport,
) => Promise<void>;

function emptyCounts() {
  return { rows: 0, updated: 0, reused: 0 };
}

function emptyMetrics(): CatalogMigrationRunMetrics {
  return {
    core: {
      familiesCreated: 0,
      familiesReused: 0,
      releasesCreated: 0,
      releasesReused: 0,
    },
    aliases: emptyCounts(),
    observations: emptyCounts(),
    consumerSlots: {
      tasting: emptyCounts(),
      review: emptyCounts(),
      collection_bottle: emptyCounts(),
      flight_bottle: emptyCounts(),
      store_price: emptyCounts(),
      incoming_bottle_decision_log: emptyCounts(),
      "store_price_match_proposal.current": emptyCounts(),
      "store_price_match_proposal.suggested": emptyCounts(),
      "store_price_match_attempt.current": emptyCounts(),
      "store_price_match_attempt.suggested": emptyCounts(),
    },
  };
}

function evidenceMatches(
  evidence: CatalogMigrationRunEvidence,
  current: Omit<CatalogMigrationRunEvidence, "generatedAt">,
): boolean {
  return (
    evidence.gitRevision === current.gitRevision &&
    evidence.databaseName === current.databaseName &&
    evidence.databaseMigration.id === current.databaseMigration.id &&
    evidence.databaseMigration.hash === current.databaseMigration.hash &&
    evidence.databaseMigration.createdAt === current.databaseMigration.createdAt
  );
}

function approvalsMatch(
  left: CatalogMigrationWriteApproval,
  right: CatalogMigrationWriteApproval,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function postgresErrorCode(error: unknown): string | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return null;
  }
  return error.code;
}

function isRetryableDatabaseError(code: string | null): boolean {
  return (
    code === "40001" ||
    code === "40P01" ||
    code === "55P03" ||
    code?.startsWith("08") === true
  );
}

function operationFailureFor(
  phase: CatalogMigrationOperationFailure["phase"],
  parentId: number,
  error: unknown,
): CatalogMigrationOperationFailure {
  if (phase === "core" && error instanceof CatalogMigrationBackfillError) {
    return {
      phase: "core",
      parentId: error.parentId,
      code: error.code,
      retryable: false,
      releaseId: error.releaseId,
    };
  }
  if (
    phase === "alias_observation" &&
    error instanceof CatalogMigrationAliasObservationBackfillError
  ) {
    const familyReleaseId =
      error.table === null && typeof error.rowId === "number"
        ? error.rowId
        : null;
    return {
      phase: "alias_observation",
      parentId: error.parentId,
      code: error.code,
      retryable: error.code === "row_changed",
      releaseId: familyReleaseId,
      table: error.table,
      rowId: error.table === null ? null : error.rowId,
    };
  }
  if (
    phase === "consumers" &&
    error instanceof CatalogMigrationConsumerBackfillError
  ) {
    const releaseId = error.details.releaseId;
    return {
      phase: "consumers",
      parentId: error.parentId,
      code: error.code,
      retryable: error.code === "row_changed",
      releaseId: typeof releaseId === "number" ? releaseId : null,
      surface: error.surface,
      rowId: error.rowId,
      projection: error.projection,
    };
  }
  const databaseCode = postgresErrorCode(error);
  const common = {
    parentId,
    code: databaseCode ?? "unexpected_error",
    retryable: isRetryableDatabaseError(databaseCode),
    releaseId: null,
  };
  if (phase === "core") return { phase, ...common };
  if (phase === "alias_observation") {
    return { phase, ...common, table: null, rowId: null };
  }
  return {
    phase,
    ...common,
    surface: null,
    rowId: null,
    projection: null,
  };
}

function checkpointFailure(
  parentId: number | null,
  originalFailure?: CatalogMigrationOperationFailure,
): CatalogMigrationRunFailure {
  return {
    phase: "checkpoint",
    parentId,
    code: "checkpoint_persist_failed",
    retryable: true,
    ...(originalFailure === undefined ? {} : { originalFailure }),
  };
}

function addCounts(
  current: { rows: number; updated: number; reused: number },
  added: { rows: number; updated: number; reused: number },
) {
  return {
    rows: current.rows + added.rows,
    updated: current.updated + added.updated,
    reused: current.reused + added.reused,
  };
}

function addFamilyMetrics(
  metrics: CatalogMigrationRunMetrics,
  core: CatalogMigrationParentResult,
  aliases: Awaited<
    ReturnType<typeof backfillLegacyCatalogAliasObservationsForParent>
  >,
  consumers: CatalogMigrationConsumerBackfillResult,
): CatalogMigrationRunMetrics {
  const consumerSlots = { ...metrics.consumerSlots };
  for (const slot of CATALOG_MIGRATION_CONSUMER_SLOTS) {
    consumerSlots[slot] = addCounts(consumerSlots[slot], consumers.slots[slot]);
  }
  return {
    core: {
      familiesCreated:
        metrics.core.familiesCreated + (core.outcome === "created" ? 1 : 0),
      familiesReused:
        metrics.core.familiesReused + (core.outcome === "reused" ? 1 : 0),
      releasesCreated:
        metrics.core.releasesCreated +
        core.promoted.filter(({ outcome }) => outcome === "created").length,
      releasesReused:
        metrics.core.releasesReused +
        core.promoted.filter(({ outcome }) => outcome === "reused").length,
    },
    aliases: addCounts(metrics.aliases, {
      rows: aliases.aliasRows,
      updated: aliases.aliasesUpdated,
      reused: aliases.aliasesReused,
    }),
    observations: addCounts(metrics.observations, {
      rows: aliases.observationRows,
      updated: aliases.observationsUpdated,
      reused: aliases.observationsReused,
    }),
    consumerSlots,
  };
}

function withFailure(
  report: CatalogMigrationRunReport,
  failure: CatalogMigrationRunFailure,
): CatalogMigrationRunReport {
  return CatalogMigrationRunReportSchema.parse({
    ...report,
    status: "failed",
    failure,
  });
}

async function persistOperationFailure(
  report: CatalogMigrationRunReport,
  failure: CatalogMigrationOperationFailure,
  checkpoint: CatalogMigrationCheckpointWriter,
): Promise<CatalogMigrationRunReport> {
  const failedReport = withFailure(report, failure);
  try {
    await checkpoint(failedReport);
    return failedReport;
  } catch {
    return withFailure(report, checkpointFailure(failure.parentId, failure));
  }
}

/** Builds revisioned dry-run evidence without invoking migration writers. */
export async function runCatalogMigrationDryRun(
  input: unknown,
  database: AnyConnection = db,
  migrationsFolder?: string,
): Promise<CatalogMigrationRunReport> {
  const { gitRevision } = DryRunOptionsSchema.parse(input);
  const revision = await loadCatalogMigrationRevisionEvidence(
    gitRevision,
    database,
    migrationsFolder,
  );
  const audit = await runCatalogMigrationAudit(database);
  const [nextParentId = null] = await selectLegacyCatalogParentIds(
    { afterParentId: 0, limit: 1 },
    database,
  );
  return CatalogMigrationRunReportSchema.parse({
    schemaVersion: CATALOG_MIGRATION_RUN_SCHEMA_VERSION,
    mode: "dry_run",
    status: "complete",
    evidence: { ...revision, generatedAt: audit.generatedAt },
    checkpoint: {
      afterParentId: 0,
      activeParentId: null,
      nextParentId,
    },
    metrics: emptyMetrics(),
    dryRunAudit: audit,
    failure: null,
    writeApproval: null,
  });
}

/** Runs one bounded batch, checkpointing each family before its three phases. */
export async function runCatalogMigrationWriteBatch(
  input: unknown,
  checkpoint: CatalogMigrationCheckpointWriter,
  database: AnyConnection = db,
  migrationsFolder?: string,
): Promise<CatalogMigrationRunReport> {
  const options = WriteOptionsSchema.parse(input);
  const approvedDryRun = CatalogMigrationRunReportSchema.parse(
    options.approvedDryRun,
  );
  const approvalInput = CatalogMigrationWriteApprovalInputSchema.parse(
    options.approval,
  );
  if (
    approvedDryRun.mode !== "dry_run" ||
    approvedDryRun.status !== "complete" ||
    approvedDryRun.failure !== null ||
    approvedDryRun.dryRunAudit.generatedAt !==
      approvedDryRun.evidence.generatedAt ||
    approvedDryRun.dryRunAudit.databaseName !==
      approvedDryRun.evidence.databaseName
  ) {
    throw new TypeError("A completed dry-run report is required for writes.");
  }
  if (approvedDryRun.dryRunAudit.blockingIssueCount > 0) {
    throw new TypeError("The approved dry-run audit contains blocking issues.");
  }
  if (
    Date.parse(approvalInput.approvedAt) <=
    Date.parse(approvedDryRun.evidence.generatedAt)
  ) {
    throw new TypeError("Write approval must follow the approved dry run.");
  }

  const revision = await loadCatalogMigrationRevisionEvidence(
    options.gitRevision,
    database,
    migrationsFolder,
  );
  if (!evidenceMatches(approvedDryRun.evidence, revision)) {
    throw new TypeError(
      "The approved dry-run evidence does not match the write candidate.",
    );
  }
  const writeApproval: CatalogMigrationWriteApproval = {
    ...approvalInput,
    dryRunGeneratedAt: approvedDryRun.evidence.generatedAt,
    gitRevision: revision.gitRevision,
    databaseName: revision.databaseName,
    databaseMigration: revision.databaseMigration,
  };

  let report: CatalogMigrationRunReport;
  if (options.report === null || options.report === undefined) {
    const [nextParentId = null] = await selectLegacyCatalogParentIds(
      { afterParentId: 0, limit: 1 },
      database,
    );
    report = CatalogMigrationRunReportSchema.parse({
      schemaVersion: CATALOG_MIGRATION_RUN_SCHEMA_VERSION,
      mode: "write",
      status: nextParentId === null ? "complete" : "pending",
      evidence: {
        ...revision,
        generatedAt: new Date().toISOString(),
      },
      checkpoint: {
        afterParentId: 0,
        activeParentId: null,
        nextParentId,
      },
      metrics: emptyMetrics(),
      dryRunAudit: approvedDryRun.dryRunAudit,
      failure: null,
      writeApproval,
    });
  } else {
    report = CatalogMigrationRunReportSchema.parse(options.report);
    if (
      report.mode !== "write" ||
      !evidenceMatches(report.evidence, revision) ||
      report.writeApproval === null ||
      !approvalsMatch(report.writeApproval, writeApproval) ||
      JSON.stringify(report.dryRunAudit) !==
        JSON.stringify(approvedDryRun.dryRunAudit)
    ) {
      throw new TypeError(
        "The retained write report does not match its approved dry run.",
      );
    }
  }

  if (report.status === "complete") {
    try {
      await checkpoint(report);
      return report;
    } catch (error) {
      return withFailure(report, checkpointFailure(null));
    }
  }

  let completedThisBatch = 0;
  while (completedThisBatch < options.limit) {
    let parentId = report.checkpoint.activeParentId;
    if (parentId === null) {
      parentId = report.checkpoint.nextParentId;
      if (parentId === null) {
        [parentId = null] = await selectLegacyCatalogParentIds(
          { afterParentId: report.checkpoint.afterParentId, limit: 1 },
          database,
        );
      }
      if (parentId === null) {
        report = CatalogMigrationRunReportSchema.parse({
          ...report,
          status: "complete",
          failure: null,
        });
        try {
          await checkpoint(report);
          return report;
        } catch (error) {
          return withFailure(report, checkpointFailure(null));
        }
      }
      const [nextParentId = null] = await selectLegacyCatalogParentIds(
        { afterParentId: parentId, limit: 1 },
        database,
      );
      const activeReport = CatalogMigrationRunReportSchema.parse({
        ...report,
        status: "running",
        checkpoint: {
          ...report.checkpoint,
          activeParentId: parentId,
          nextParentId,
        },
        failure: null,
      });
      try {
        await checkpoint(activeReport);
      } catch (error) {
        return withFailure(report, checkpointFailure(parentId));
      }
      report = activeReport;
    } else if (report.status !== "running" || report.failure !== null) {
      const resumed = CatalogMigrationRunReportSchema.parse({
        ...report,
        status: "running",
        failure: null,
      });
      try {
        await checkpoint(resumed);
      } catch (error) {
        return withFailure(report, checkpointFailure(parentId));
      }
      report = resumed;
    }

    let core: CatalogMigrationParentResult;
    try {
      core = await backfillLegacyCatalogParent(parentId, database);
    } catch (error) {
      return await persistOperationFailure(
        report,
        operationFailureFor("core", parentId, error),
        checkpoint,
      );
    }

    let aliases: Awaited<
      ReturnType<typeof backfillLegacyCatalogAliasObservationsForParent>
    >;
    try {
      aliases = await backfillLegacyCatalogAliasObservationsForParent(
        parentId,
        database,
      );
    } catch (error) {
      return await persistOperationFailure(
        report,
        operationFailureFor("alias_observation", parentId, error),
        checkpoint,
      );
    }

    let consumers: CatalogMigrationConsumerBackfillResult;
    try {
      consumers = await backfillLegacyCatalogConsumersForParent(
        parentId,
        database,
      );
    } catch (error) {
      return await persistOperationFailure(
        report,
        operationFailureFor("consumers", parentId, error),
        checkpoint,
      );
    }

    const advanced = CatalogMigrationRunReportSchema.parse({
      ...report,
      status: report.checkpoint.nextParentId === null ? "complete" : "pending",
      checkpoint: {
        afterParentId: parentId,
        activeParentId: null,
        nextParentId: report.checkpoint.nextParentId,
      },
      metrics: addFamilyMetrics(report.metrics, core, aliases, consumers),
      failure: null,
    });
    try {
      await checkpoint(advanced);
    } catch (error) {
      return withFailure(report, checkpointFailure(parentId));
    }
    report = advanced;
    completedThisBatch += 1;
    if (report.status === "complete") return report;
  }

  return report;
}
