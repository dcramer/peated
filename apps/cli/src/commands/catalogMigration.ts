import program from "@peated/cli/program";
import config from "@peated/server/config";
import { applyCatalogMigration } from "@peated/server/lib/catalogMigrationApply";
import { runCatalogMigrationAudit } from "@peated/server/lib/catalogMigrationAudit";
import { loadCatalogMigrationRevisionEvidence } from "@peated/server/lib/catalogMigrationRevision";
import {
  CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION,
  CatalogMigrationApprovalCandidateSchema,
} from "@peated/server/schemas/catalogMigrationApply";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const FULL_GIT_REVISION = /^[0-9a-f]{40}$/;

async function resolveCleanWorktreeRevision(): Promise<string> {
  let status: string;
  let revision: string;
  try {
    ({ stdout: status } = await execFile("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }));
    ({ stdout: revision } = await execFile("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }));
  } catch (error) {
    throw new Error("Unable to resolve the local Git revision.", {
      cause: error,
    });
  }
  if (status.trim()) {
    throw new Error(
      "Catalog migration evidence requires a clean local Git worktree.",
    );
  }
  const result = revision.trim();
  if (!FULL_GIT_REVISION.test(result)) {
    throw new Error("Git did not return a full commit SHA.");
  }
  return result;
}

async function resolveCatalogMigrationGitRevision(
  expectedRevision?: string,
): Promise<string> {
  if (
    expectedRevision !== undefined &&
    !FULL_GIT_REVISION.test(expectedRevision)
  ) {
    throw new Error("--expect-git-revision must be a full commit SHA.");
  }

  const revision =
    config.ENV === "production"
      ? FULL_GIT_REVISION.test(config.VERSION)
        ? config.VERSION
        : null
      : await resolveCleanWorktreeRevision();
  if (revision === null) {
    throw new Error(
      "Production catalog migration evidence requires VERSION to be a full commit SHA.",
    );
  }
  if (expectedRevision !== undefined && revision !== expectedRevision) {
    throw new Error(
      `Catalog migration Git revision ${revision} does not match expected ${expectedRevision}.`,
    );
  }
  return revision;
}

program
  .command("audit-catalog-migration")
  .description("Emit retained approval evidence without changing data")
  .option(
    "--expect-git-revision <sha>",
    "assert the exact candidate Git commit",
  )
  .action(async (options: { expectGitRevision?: string }) => {
    const gitRevision = await resolveCatalogMigrationGitRevision(
      options.expectGitRevision,
    );
    const [audit, revision] = await Promise.all([
      runCatalogMigrationAudit(),
      loadCatalogMigrationRevisionEvidence(gitRevision),
    ]);
    const candidate = CatalogMigrationApprovalCandidateSchema.parse({
      schemaVersion: CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION,
      audit,
      revision,
    });
    process.stdout.write(`${JSON.stringify(candidate, null, 2)}\n`);
  });

program
  .command("apply-catalog-migration")
  .description("Apply an approved BottleRelease migration in one transaction")
  .requiredOption(
    "--approved-audit <path>",
    "retained approval-candidate JSON from audit-catalog-migration",
  )
  .requiredOption(
    "--expect-git-revision <sha>",
    "assert the exact candidate Git commit",
  )
  .requiredOption(
    "--approved-by <identity>",
    "identity approving the migration",
  )
  .requiredOption("--approved-at <timestamp>", "approval timestamp")
  .action(
    async (options: {
      approvedAudit: string;
      expectGitRevision: string;
      approvedBy: string;
      approvedAt: string;
    }) => {
      const gitRevision = await resolveCatalogMigrationGitRevision(
        options.expectGitRevision,
      );
      const candidate = CatalogMigrationApprovalCandidateSchema.parse(
        JSON.parse(await readFile(options.approvedAudit, "utf8")),
      );
      if (candidate.revision.gitRevision !== gitRevision) {
        throw new Error(
          `Approved catalog migration Git revision ${candidate.revision.gitRevision} does not match running revision ${gitRevision}.`,
        );
      }

      const result = await applyCatalogMigration({
        candidate,
        approval: {
          approvedBy: options.approvedBy,
          approvedAt: options.approvedAt,
        },
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    },
  );
