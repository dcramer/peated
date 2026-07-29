import program from "@peated/cli/program";
import config from "@peated/server/config";
import { applyCatalogMigration } from "@peated/server/lib/catalogMigrationApply";
import { loadCatalogMigrationApprovalCandidate } from "@peated/server/lib/catalogMigrationApprovalCandidate";
import { CatalogMigrationApprovalCandidateSchema } from "@peated/server/schemas/catalogMigrationApply";
import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
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
      ? FULL_GIT_REVISION.test(
          config.VERSION || process.env.RENDER_GIT_COMMIT || "",
        )
        ? config.VERSION || process.env.RENDER_GIT_COMMIT!
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
  .argument("<output>", "path for the retained approval-candidate JSON")
  .action(async (output: string) => {
    const gitRevision = await resolveCatalogMigrationGitRevision();
    const candidate = await loadCatalogMigrationApprovalCandidate(gitRevision);
    await writeFile(output, `${JSON.stringify(candidate, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(
      `Catalog migration audit written to ${output} (${candidate.audit.blockingIssueCount} blocking issues, ${candidate.audit.warningCount} warnings).\n`,
    );
  });

program
  .command("apply-catalog-migration")
  .description("Apply an approved BottleRelease migration in one transaction")
  .argument(
    "<approved-audit>",
    "retained approval-candidate JSON from audit-catalog-migration",
  )
  .action(async (approvedAudit: string) => {
    const candidate = CatalogMigrationApprovalCandidateSchema.parse(
      JSON.parse(await readFile(approvedAudit, "utf8")),
    );
    const gitRevision = await resolveCatalogMigrationGitRevision(
      candidate.revision.gitRevision,
    );
    if (candidate.revision.gitRevision !== gitRevision) {
      throw new Error(
        `Approved catalog migration Git revision ${candidate.revision.gitRevision} does not match running revision ${gitRevision}.`,
      );
    }

    const result = await applyCatalogMigration({
      candidate,
      approval: {
        approvedBy: process.env.USER?.trim() || "cli-operator",
        approvedAt: new Date(
          Math.max(Date.now(), Date.parse(candidate.audit.generatedAt) + 1),
        ).toISOString(),
      },
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
