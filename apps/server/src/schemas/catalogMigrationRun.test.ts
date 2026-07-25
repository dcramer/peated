import { describe, expect, it } from "vitest";
import {
  CATALOG_MIGRATION_CONSUMER_SLOTS,
  CATALOG_MIGRATION_RUN_SCHEMA_VERSION,
  CatalogMigrationRunReportSchema,
} from "./catalogMigrationRun";

const DRY_RUN_GENERATED_AT = "2026-01-01T00:00:00.000Z";
const WRITE_GENERATED_AT = "2026-01-02T00:00:00.000Z";
const APPROVED_AT = "2026-01-01T01:00:00.000Z";
const GIT_REVISION = "a".repeat(40);
const DATABASE_MIGRATION = {
  id: 1,
  hash: "migration-hash",
  createdAt: 1,
};

function emptyMetrics() {
  const emptyCount = () => ({ rows: 0, updated: 0, reused: 0 });
  return {
    core: {
      familiesCreated: 0,
      familiesReused: 0,
      releasesCreated: 0,
      releasesReused: 0,
    },
    aliases: emptyCount(),
    observations: emptyCount(),
    consumerSlots: Object.fromEntries(
      CATALOG_MIGRATION_CONSUMER_SLOTS.map((slot) => [slot, emptyCount()]),
    ),
  };
}

function dryRunAudit() {
  return {
    schemaVersion: 2 as const,
    generatedAt: DRY_RUN_GENERATED_AT,
    databaseName: "peated_test",
    legacyCatalog: {
      totalParents: 0,
      parentsWithZeroReleases: 0,
      parentsWithOneRelease: 0,
      parentsWithMultipleReleases: 0,
      totalReleases: 0,
      parentsWithReleaseLikeFields: 0,
      childParentAgeConflicts: 0,
      orphanReleases: 0,
      missingParentCreators: 0,
      missingReleaseCreators: 0,
      missingParentAliases: 0,
      missingReleaseAliases: 0,
      missingParentImages: 0,
      missingReleaseImages: 0,
    },
    references: [],
    collisions: { count: 0, items: [] },
    promotionMappings: {
      tablePresent: true,
      totalLegacyReleases: 0,
      totalMappings: 0,
      mappedReleases: 0,
      unmappedReleases: 0,
      completedMappings: 0,
      pendingMappings: 0,
      failedMappings: 0,
      partialMappings: 0,
      invalidStatusMappings: 0,
      duplicateReleaseMappings: 0,
      missingLegacyReleases: 0,
      missingPromotedBottles: 0,
    },
    blockingIssueCount: 0,
    warningCount: 0,
  };
}

function evidence(generatedAt: string) {
  return {
    generatedAt,
    gitRevision: GIT_REVISION,
    databaseName: "peated_test",
    databaseMigration: DATABASE_MIGRATION,
  };
}

function validDryRunReport() {
  return {
    schemaVersion: CATALOG_MIGRATION_RUN_SCHEMA_VERSION,
    mode: "dry_run",
    status: "complete",
    evidence: evidence(DRY_RUN_GENERATED_AT),
    checkpoint: {
      afterParentId: 0,
      activeParentId: null,
      nextParentId: 10,
    },
    metrics: emptyMetrics(),
    dryRunAudit: dryRunAudit(),
    failure: null,
    writeApproval: null,
  };
}

function validWriteReport(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CATALOG_MIGRATION_RUN_SCHEMA_VERSION,
    mode: "write",
    status: "pending",
    evidence: evidence(WRITE_GENERATED_AT),
    checkpoint: {
      afterParentId: 0,
      activeParentId: null,
      nextParentId: 10,
    },
    metrics: emptyMetrics(),
    dryRunAudit: dryRunAudit(),
    failure: null,
    writeApproval: {
      approvedAt: APPROVED_AT,
      approvedBy: "catalog-migration-test",
      dryRunGeneratedAt: DRY_RUN_GENERATED_AT,
      gitRevision: GIT_REVISION,
      databaseName: "peated_test",
      databaseMigration: DATABASE_MIGRATION,
    },
    ...overrides,
  };
}

function coreFailure(parentId = 10) {
  return {
    phase: "core",
    parentId,
    code: "target_conflict",
    retryable: false,
    releaseId: null,
  };
}

function failedWriteReport(
  failure: Record<string, unknown>,
  checkpoint: {
    afterParentId: number;
    activeParentId: number | null;
    nextParentId: number | null;
  } = {
    afterParentId: 0,
    activeParentId: 10,
    nextParentId: 20,
  },
) {
  return validWriteReport({ status: "failed", checkpoint, failure });
}

describe("CatalogMigrationRunReportSchema", () => {
  it.each([
    { name: "completed dry run", input: validDryRunReport() },
    { name: "pending write", input: validWriteReport() },
    {
      name: "running write",
      input: validWriteReport({
        status: "running",
        checkpoint: {
          afterParentId: 0,
          activeParentId: 10,
          nextParentId: 20,
        },
      }),
    },
    {
      name: "completed write",
      input: validWriteReport({
        status: "complete",
        checkpoint: {
          afterParentId: 20,
          activeParentId: null,
          nextParentId: null,
        },
      }),
    },
    {
      name: "operation failure",
      input: failedWriteReport(coreFailure()),
    },
    {
      name: "composite checkpoint failure",
      input: failedWriteReport({
        phase: "checkpoint",
        parentId: 10,
        code: "checkpoint_persist_failed",
        retryable: true,
        originalFailure: coreFailure(),
      }),
    },
    {
      name: "active checkpoint failure",
      input: failedWriteReport({
        phase: "checkpoint",
        parentId: 10,
        code: "checkpoint_persist_failed",
        retryable: true,
      }),
    },
    {
      name: "pre-core checkpoint failure",
      input: failedWriteReport(
        {
          phase: "checkpoint",
          parentId: 10,
          code: "checkpoint_persist_failed",
          retryable: true,
        },
        { afterParentId: 0, activeParentId: null, nextParentId: 10 },
      ),
    },
    {
      name: "final no-work checkpoint failure",
      input: failedWriteReport(
        {
          phase: "checkpoint",
          parentId: null,
          code: "checkpoint_persist_failed",
          retryable: true,
        },
        { afterParentId: 20, activeParentId: null, nextParentId: null },
      ),
    },
  ])("accepts a valid $name report", ({ input }) => {
    expect(CatalogMigrationRunReportSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    {
      name: "aliases",
      input: (() => {
        const report = validWriteReport();
        return {
          ...report,
          metrics: {
            ...report.metrics,
            aliases: { rows: 2, updated: 1, reused: 0 },
          },
        };
      })(),
    },
    {
      name: "consumer slot",
      input: (() => {
        const report = validWriteReport();
        return {
          ...report,
          metrics: {
            ...report.metrics,
            consumerSlots: {
              ...report.metrics.consumerSlots,
              tasting: { rows: 1, updated: 1, reused: 1 },
            },
          },
        };
      })(),
    },
  ])("rejects invalid count arithmetic for $name", ({ input }) => {
    expect(CatalogMigrationRunReportSchema.safeParse(input).success).toBe(
      false,
    );
  });

  it.each([
    {
      name: "a non-complete dry run",
      input: { ...validDryRunReport(), status: "pending" },
    },
    {
      name: "an advanced dry-run cursor",
      input: {
        ...validDryRunReport(),
        checkpoint: {
          afterParentId: 1,
          activeParentId: null,
          nextParentId: 10,
        },
      },
    },
    {
      name: "a pending write without a next parent",
      input: validWriteReport({
        checkpoint: {
          afterParentId: 0,
          activeParentId: null,
          nextParentId: null,
        },
      }),
    },
    {
      name: "a running write without an active parent",
      input: validWriteReport({ status: "running" }),
    },
    {
      name: "a complete write with pending work",
      input: validWriteReport({ status: "complete" }),
    },
    {
      name: "a failed write without failure evidence",
      input: validWriteReport({
        status: "failed",
        checkpoint: {
          afterParentId: 0,
          activeParentId: 10,
          nextParentId: 20,
        },
      }),
    },
    {
      name: "an active parent at the completed cursor",
      input: validWriteReport({
        status: "running",
        checkpoint: {
          afterParentId: 10,
          activeParentId: 10,
          nextParentId: 20,
        },
      }),
    },
    {
      name: "a next parent at the active cursor",
      input: validWriteReport({
        status: "running",
        checkpoint: {
          afterParentId: 0,
          activeParentId: 10,
          nextParentId: 10,
        },
      }),
    },
  ])("rejects $name", ({ input }) => {
    expect(CatalogMigrationRunReportSchema.safeParse(input).success).toBe(
      false,
    );
  });

  it("rejects blank approval ownership", () => {
    const report = validWriteReport();
    expect(
      CatalogMigrationRunReportSchema.safeParse({
        ...report,
        writeApproval: { ...report.writeApproval, approvedBy: "   " },
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      name: "missing proposal projection",
      failure: {
        phase: "consumers",
        parentId: 10,
        code: "row_changed",
        retryable: false,
        releaseId: null,
        surface: "store_price_match_proposal",
        rowId: 1,
        projection: null,
      },
    },
    {
      name: "projection on an unprojected surface",
      failure: {
        phase: "consumers",
        parentId: 10,
        code: "row_changed",
        retryable: false,
        releaseId: null,
        surface: "tasting",
        rowId: 1,
        projection: "current",
      },
    },
  ])("rejects $name", ({ failure }) => {
    expect(
      CatalogMigrationRunReportSchema.safeParse(failedWriteReport(failure))
        .success,
    ).toBe(false);
  });

  it.each([
    { name: "blank string", rowId: "   " },
    { name: "zero", rowId: 0 },
    { name: "negative integer", rowId: -1 },
  ])("rejects a $name failure row ID", ({ rowId }) => {
    expect(
      CatalogMigrationRunReportSchema.safeParse(
        failedWriteReport({
          phase: "alias_observation",
          parentId: 10,
          code: "row_changed",
          retryable: false,
          releaseId: null,
          table: "bottle_alias",
          rowId,
        }),
      ).success,
    ).toBe(false);
  });

  it.each([
    {
      name: "operation failure for another parent",
      input: failedWriteReport(coreFailure(11)),
    },
    {
      name: "checkpoint and original failures for different parents",
      input: failedWriteReport({
        phase: "checkpoint",
        parentId: 10,
        code: "checkpoint_persist_failed",
        retryable: true,
        originalFailure: coreFailure(11),
      }),
    },
    {
      name: "matching composite failures for a non-active parent",
      input: failedWriteReport({
        phase: "checkpoint",
        parentId: 11,
        code: "checkpoint_persist_failed",
        retryable: true,
        originalFailure: coreFailure(11),
      }),
    },
    {
      name: "checkpoint failure for a non-active parent",
      input: failedWriteReport({
        phase: "checkpoint",
        parentId: 11,
        code: "checkpoint_persist_failed",
        retryable: true,
      }),
    },
    {
      name: "pre-core checkpoint failure for a non-next parent",
      input: failedWriteReport(
        {
          phase: "checkpoint",
          parentId: 11,
          code: "checkpoint_persist_failed",
          retryable: true,
        },
        { afterParentId: 0, activeParentId: null, nextParentId: 10 },
      ),
    },
    {
      name: "parentless checkpoint failure with pending work",
      input: failedWriteReport(
        {
          phase: "checkpoint",
          parentId: null,
          code: "checkpoint_persist_failed",
          retryable: true,
        },
        { afterParentId: 0, activeParentId: null, nextParentId: 10 },
      ),
    },
  ])("rejects a $name", ({ input }) => {
    expect(CatalogMigrationRunReportSchema.safeParse(input).success).toBe(
      false,
    );
  });
});
