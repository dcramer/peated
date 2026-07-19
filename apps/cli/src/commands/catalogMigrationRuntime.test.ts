import type { CatalogMigrationRunReport } from "@peated/server/schemas/catalogMigrationRun";
import type { FileHandle } from "node:fs/promises";
import * as fsPromises from "node:fs/promises";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  acquireCatalogMigrationReportLock,
  catalogMigrationReportExists,
  formatCatalogMigrationRunReport,
  loadCatalogMigrationReport,
  resolveCatalogMigrationGitRevision,
  withCatalogMigrationReportLock,
  writeCatalogMigrationReport,
} from "./catalogMigrationRuntime";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return { ...actual, open: vi.fn(actual.open) };
});

const ZERO_COUNTS = { rows: 0, updated: 0, reused: 0 } as const;

function makeReport(
  overrides: Partial<CatalogMigrationRunReport> = {},
): CatalogMigrationRunReport {
  return {
    schemaVersion: 1,
    mode: "dry_run",
    status: "complete",
    evidence: {
      generatedAt: "2026-07-18T12:00:00.000Z",
      gitRevision: "a".repeat(40),
      databaseName: "peated_test",
      databaseMigration: {
        id: 1,
        hash: "migration-hash",
        createdAt: 1_700_000_000_000,
      },
    },
    checkpoint: {
      afterParentId: 0,
      activeParentId: null,
      nextParentId: 1,
    },
    metrics: {
      core: {
        familiesCreated: 0,
        familiesReused: 0,
        releasesCreated: 0,
        releasesReused: 0,
      },
      aliases: ZERO_COUNTS,
      observations: ZERO_COUNTS,
      consumerSlots: {
        tasting: ZERO_COUNTS,
        review: ZERO_COUNTS,
        collection_bottle: ZERO_COUNTS,
        flight_bottle: ZERO_COUNTS,
        store_price: ZERO_COUNTS,
        incoming_bottle_decision_log: ZERO_COUNTS,
        "store_price_match_proposal.current": ZERO_COUNTS,
        "store_price_match_proposal.suggested": ZERO_COUNTS,
        "store_price_match_attempt.current": ZERO_COUNTS,
        "store_price_match_attempt.suggested": ZERO_COUNTS,
      },
    },
    dryRunAudit: {
      schemaVersion: 1,
      generatedAt: "2026-07-18T12:00:00.000Z",
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
        mappedReleases: 0,
        unmappedReleases: 0,
        duplicateReleaseMappings: 0,
        missingLegacyReleases: 0,
        missingPromotedBottles: 0,
      },
      blockingIssueCount: 0,
      warningCount: 0,
    },
    failure: null,
    writeApproval: null,
    ...overrides,
  };
}

describe("catalog migration runtime", () => {
  let directory: string;
  let reportPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "peated-catalog-migration-"));
    reportPath = join(directory, "report.json");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("creates, directory-syncs, and parses a retained report", async () => {
    const report = makeReport();

    await writeCatalogMigrationReport(reportPath, report, { replace: false });

    await expect(loadCatalogMigrationReport(reportPath)).resolves.toEqual(
      report,
    );
    expect(await readdir(directory)).toEqual(["report.json"]);
  });

  test("fsyncs and closes the parent directory after publication", async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const actual = await vi.importActual<typeof fsPromises>("node:fs/promises");
    vi.mocked(fsPromises.open).mockImplementation(async (...args) => {
      if (args[0] === directory && args[1] === "r") {
        return { sync, close } as unknown as FileHandle;
      }
      return await actual.open(...args);
    });

    await writeCatalogMigrationReport(reportPath, makeReport(), {
      replace: false,
    });

    expect(sync).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    await expect(loadCatalogMigrationReport(reportPath)).resolves.toEqual(
      makeReport(),
    );
  });

  test("refuses duplicate creation without changing the retained report", async () => {
    const original = makeReport();
    await writeCatalogMigrationReport(reportPath, original, { replace: false });
    const originalContents = await readFile(reportPath, "utf8");
    const duplicate = makeReport();
    duplicate.evidence.generatedAt = "2026-07-18T13:00:00.000Z";
    duplicate.dryRunAudit.generatedAt = "2026-07-18T13:00:00.000Z";

    await expect(
      writeCatalogMigrationReport(reportPath, duplicate, { replace: false }),
    ).rejects.toMatchObject({ code: "EEXIST" });

    expect(await readFile(reportPath, "utf8")).toBe(originalContents);
    expect(await readdir(directory)).toEqual(["report.json"]);
  });

  test("atomically replaces a retained report without leaving temp files", async () => {
    await writeCatalogMigrationReport(reportPath, makeReport(), {
      replace: false,
    });
    const replacement = makeReport();
    replacement.evidence.generatedAt = "2026-07-18T13:00:00.000Z";
    replacement.dryRunAudit.generatedAt = "2026-07-18T13:00:00.000Z";

    await writeCatalogMigrationReport(reportPath, replacement, {
      replace: true,
    });

    await expect(loadCatalogMigrationReport(reportPath)).resolves.toEqual(
      replacement,
    );
    expect(await readdir(directory)).toEqual(["report.json"]);
  });

  test("excludes concurrent write owners and cleans up the lock", async () => {
    const release = await acquireCatalogMigrationReportLock(reportPath);
    let competingWriterRan = false;

    await expect(
      withCatalogMigrationReportLock(reportPath, async () => {
        competingWriterRan = true;
      }),
    ).rejects.toThrow("is locked by another writer");
    expect(competingWriterRan).toBe(false);
    expect(await catalogMigrationReportExists(`${reportPath}.lock`)).toBe(true);

    await release();

    expect(await catalogMigrationReportExists(`${reportPath}.lock`)).toBe(
      false,
    );
    await expect(
      withCatalogMigrationReportLock(reportPath, async () => "complete"),
    ).resolves.toBe("complete");
    expect(await readdir(directory)).toEqual([]);
  });

  test("uses clean worktree HEAD outside production despite stale VERSION", async () => {
    const worktreeRevision = "a".repeat(40);
    const staleVersion = "b".repeat(40);
    const runtime = {
      environment: "development",
      version: staleVersion,
      resolveWorktreeRevision: async () => worktreeRevision,
    };

    await expect(
      resolveCatalogMigrationGitRevision(worktreeRevision, runtime),
    ).resolves.toBe(worktreeRevision);
    await expect(
      resolveCatalogMigrationGitRevision(staleVersion, runtime),
    ).rejects.toThrow(`does not match expected ${staleVersion}`);
  });

  test("uses configured VERSION only in production", async () => {
    const version = "c".repeat(40);
    let worktreeResolverCalled = false;

    await expect(
      resolveCatalogMigrationGitRevision(version, {
        environment: "production",
        version,
        resolveWorktreeRevision: async () => {
          worktreeResolverCalled = true;
          return "d".repeat(40);
        },
      }),
    ).resolves.toBe(version);
    expect(worktreeResolverCalled).toBe(false);
  });

  test.each(["", "not-a-revision", "e".repeat(39)])(
    "rejects missing or invalid production VERSION %j",
    async (version) => {
      await expect(
        resolveCatalogMigrationGitRevision(undefined, {
          environment: "production",
          version,
        }),
      ).rejects.toThrow(
        "Production catalog migration evidence requires VERSION to be a full commit SHA.",
      );
    },
  );

  test("does not fall back to stale VERSION when worktree resolution rejects", async () => {
    const dirtyWorktreeError = new Error(
      "Catalog migration evidence requires a clean local Git worktree.",
    );

    await expect(
      resolveCatalogMigrationGitRevision(undefined, {
        environment: "development",
        version: "f".repeat(40),
        resolveWorktreeRevision: async () => {
          throw dirtyWorktreeError;
        },
      }),
    ).rejects.toBe(dirtyWorktreeError);
  });

  test("formats the original operation locator for checkpoint failures", () => {
    const dryRun = makeReport();
    const report = makeReport({
      mode: "write",
      status: "failed",
      evidence: {
        ...dryRun.evidence,
        generatedAt: "2026-07-18T12:02:00.000Z",
      },
      checkpoint: {
        afterParentId: 0,
        activeParentId: 1,
        nextParentId: null,
      },
      failure: {
        phase: "checkpoint",
        parentId: 1,
        code: "checkpoint_persist_failed",
        retryable: true,
        originalFailure: {
          phase: "consumers",
          parentId: 1,
          code: "target_conflict",
          retryable: false,
          releaseId: 2,
          surface: "store_price_match_proposal",
          rowId: 3,
          projection: "suggested",
        },
      },
      writeApproval: {
        approvedAt: "2026-07-18T12:01:00.000Z",
        approvedBy: "migration-operator",
        dryRunGeneratedAt: dryRun.evidence.generatedAt,
        gitRevision: dryRun.evidence.gitRevision,
        databaseName: dryRun.evidence.databaseName,
        databaseMigration: dryRun.evidence.databaseMigration,
      },
    });

    expect(formatCatalogMigrationRunReport(report)).toContain(
      "Original failure: consumers/target_conflict parent 1 release 2 store_price_match_proposal 3 suggested",
    );
  });
});
