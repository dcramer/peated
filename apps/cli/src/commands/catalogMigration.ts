import program from "@peated/cli/program";
import {
  formatCatalogMigrationAudit,
  runCatalogMigrationAudit,
} from "@peated/server/lib/catalogMigrationAudit";

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
