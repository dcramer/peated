import program from "@peated/cli/program";
import {
  formatCatalogMigrationAudit,
  runCatalogMigrationAudit,
} from "@peated/server/lib/catalogMigrationAudit";
import {
  runCatalogMigrationDryRun,
  runCatalogMigrationWriteBatch,
} from "@peated/server/lib/catalogMigrationOrchestrator";
import type { CatalogMigrationRunReport } from "@peated/server/schemas/catalogMigrationRun";
import {
  catalogMigrationReportExists,
  formatCatalogMigrationRunReport,
  loadCatalogMigrationReport,
  resolveCatalogMigrationGitRevision,
  withCatalogMigrationReportLock,
  writeCatalogMigrationReport,
} from "./catalogMigrationRuntime";

program
  .command("audit-catalog-migration")
  .description("Audit BottleRelease migration readiness without changing data")
  .option("--json", "emit the versioned JSON report")
  .action(async (options: { json?: boolean }) => {
    const report = await runCatalogMigrationAudit();
    process.stdout.write(
      options.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${formatCatalogMigrationAudit(report)}\n`,
    );
  });

type CatalogMigrationOptions = {
  report: string;
  write?: boolean;
  resume?: boolean;
  batchSize: string;
  approvedDryRun?: string;
  approvedBy?: string;
  approvedAt?: string;
  expectGitRevision?: string;
  json?: boolean;
};

function parseBatchSize(value: string): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 1_000) {
    throw new Error("--batch-size must be an integer from 1 through 1000.");
  }
  return result;
}

function writeFinalOutput(
  report: CatalogMigrationRunReport,
  { json }: { json?: boolean },
): void {
  process.stdout.write(
    json
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${formatCatalogMigrationRunReport(report)}\n`,
  );
}

program
  .command("backfill-catalog-migration")
  .description("Dry-run or checkpoint the BottleRelease catalog migration")
  .requiredOption("--report <path>", "retained JSON report and checkpoint")
  .option("--write", "perform one bounded write batch")
  .option("--resume", "resume and overwrite the retained write report")
  .option("--batch-size <count>", "parent families per write batch", "100")
  .option(
    "--approved-dry-run <path>",
    "completed retained dry-run report approved for writes",
  )
  .option("--approved-by <identity>", "identity approving the dry run")
  .option("--approved-at <timestamp>", "approval timestamp (defaults to now)")
  .option(
    "--expect-git-revision <sha>",
    "assert the exact candidate Git commit",
  )
  .option("--json", "emit the final versioned JSON report")
  .action(async (options: CatalogMigrationOptions) => {
    const batchSize = parseBatchSize(options.batchSize);

    if (!options.write) {
      const gitRevision = await resolveCatalogMigrationGitRevision(
        options.expectGitRevision,
      );
      const reportExists = await catalogMigrationReportExists(options.report);
      if (options.resume) {
        throw new Error("Dry-run reports cannot be resumed or overwritten.");
      }
      if (reportExists) {
        throw new Error(
          `Refusing to overwrite retained dry-run report ${options.report}.`,
        );
      }
      if (options.approvedDryRun || options.approvedBy || options.approvedAt) {
        throw new Error("Approval options require --write.");
      }
      const report = await runCatalogMigrationDryRun({ gitRevision });
      await writeCatalogMigrationReport(options.report, report, {
        replace: false,
      });
      writeFinalOutput(report, options);
      return;
    }

    await withCatalogMigrationReportLock(options.report, async () => {
      const gitRevision = await resolveCatalogMigrationGitRevision(
        options.expectGitRevision,
      );
      const reportExists = await catalogMigrationReportExists(options.report);
      if (!options.approvedDryRun) {
        throw new Error("--write requires --approved-dry-run.");
      }
      if (options.resume !== reportExists) {
        throw new Error(
          reportExists
            ? "Existing write reports require --resume."
            : "--resume requires an existing retained write report.",
        );
      }

      const approvedDryRun = await loadCatalogMigrationReport(
        options.approvedDryRun,
      );
      const retainedReport = options.resume
        ? await loadCatalogMigrationReport(options.report)
        : undefined;
      const retainedApproval = retainedReport?.writeApproval;
      const approvedBy = options.approvedBy ?? retainedApproval?.approvedBy;
      const approvedAt = options.approvedAt ?? retainedApproval?.approvedAt;
      if (!approvedBy) {
        throw new Error("New writes require --approved-by.");
      }
      let checkpointExists = reportExists;
      const checkpoint = async (report: CatalogMigrationRunReport) => {
        await writeCatalogMigrationReport(options.report, report, {
          replace: checkpointExists,
        });
        checkpointExists = true;
        process.stderr.write(
          `Catalog migration ${report.status}: after ${report.checkpoint.afterParentId}, active ${report.checkpoint.activeParentId ?? "none"}, next ${report.checkpoint.nextParentId ?? "none"}\n`,
        );
      };
      const report = await runCatalogMigrationWriteBatch(
        {
          gitRevision,
          limit: batchSize,
          report: retainedReport,
          approvedDryRun,
          approval: {
            approvedBy,
            approvedAt: approvedAt ?? new Date().toISOString(),
          },
        },
        checkpoint,
      );
      writeFinalOutput(report, options);
      if (report.status === "failed") process.exitCode = 1;
    });
  });
