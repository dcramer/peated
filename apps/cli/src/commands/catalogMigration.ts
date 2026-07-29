import program from "@peated/cli/program";
import config from "@peated/server/config";
import { loadCatalogMigrationApprovalCandidate } from "@peated/server/lib/catalogMigrationApprovalCandidate";
import { execFile as execFileCallback } from "node:child_process";
import { writeFile } from "node:fs/promises";
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

async function resolveCatalogMigrationGitRevision(): Promise<string> {
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
