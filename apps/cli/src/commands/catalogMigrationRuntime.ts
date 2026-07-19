import config from "@peated/server/config";
import {
  CatalogMigrationRunReportSchema,
  type CatalogMigrationOperationFailure,
  type CatalogMigrationRunReport,
} from "@peated/server/schemas/catalogMigrationRun";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  link,
  open,
  readFile,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const FULL_GIT_REVISION = /^[0-9a-f]{40}$/;

type CatalogMigrationGitRevisionRuntime = {
  environment?: string;
  version?: string;
  resolveWorktreeRevision?: () => Promise<string>;
};

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

export async function resolveCatalogMigrationGitRevision(
  expectedRevision?: string,
  {
    environment = config.ENV,
    version = config.VERSION,
    resolveWorktreeRevision = resolveCleanWorktreeRevision,
  }: CatalogMigrationGitRevisionRuntime = {},
): Promise<string> {
  if (
    expectedRevision !== undefined &&
    !FULL_GIT_REVISION.test(expectedRevision)
  ) {
    throw new Error("--expect-git-revision must be a full commit SHA.");
  }

  const revision =
    environment === "production"
      ? FULL_GIT_REVISION.test(version)
        ? version
        : null
      : await resolveWorktreeRevision();
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

export async function acquireCatalogMigrationReportLock(
  path: string,
): Promise<() => Promise<void>> {
  const lockPath = `${path}.lock`;
  let handle: FileHandle | undefined;
  try {
    handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(
        `Catalog migration report ${path} is locked by another writer.`,
        { cause: error },
      );
    }
    throw error;
  }
  const lockHandle = handle;

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await lockHandle.close();
    } finally {
      await unlink(lockPath).catch((error: unknown) => {
        if (
          typeof error !== "object" ||
          error === null ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error;
        }
      });
    }
  };
}

export async function withCatalogMigrationReportLock<T>(
  path: string,
  callback: () => Promise<T>,
): Promise<T> {
  const release = await acquireCatalogMigrationReportLock(path);
  try {
    return await callback();
  } finally {
    await release();
  }
}

export async function loadCatalogMigrationReport(
  path: string,
): Promise<CatalogMigrationRunReport> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  return CatalogMigrationRunReportSchema.parse(raw);
}

export async function catalogMigrationReportExists(
  path: string,
): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

/** Makes the published link or rename durable after the report file is synced. */
async function syncParentDirectory(path: string): Promise<void> {
  const handle = await open(dirname(path), "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Persists a parsed report through an atomic same-directory file operation. */
export async function writeCatalogMigrationReport(
  path: string,
  report: CatalogMigrationRunReport,
  { replace }: { replace: boolean },
): Promise<void> {
  const parsed = CatalogMigrationRunReportSchema.parse(report);
  const tempPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const handle = await open(tempPath, "wx", 0o600);
  try {
    try {
      await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (replace) {
      await rename(tempPath, path);
    } else {
      await link(tempPath, path);
      await unlink(tempPath).catch(() => undefined);
    }
    await syncParentDirectory(path);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

function formatOperationFailure(
  failure: CatalogMigrationOperationFailure,
): string {
  const locators = [`parent ${failure.parentId}`];
  if (failure.releaseId !== null) {
    locators.push(`release ${failure.releaseId}`);
  }
  if (
    failure.phase === "alias_observation" &&
    failure.table !== null &&
    failure.rowId !== null
  ) {
    locators.push(`${failure.table} ${failure.rowId}`);
  }
  if (
    failure.phase === "consumers" &&
    failure.surface !== null &&
    failure.rowId !== null
  ) {
    locators.push(`${failure.surface} ${failure.rowId}`);
    if (failure.projection !== null) locators.push(failure.projection);
  }
  return `${failure.phase}/${failure.code} ${locators.join(" ")}`;
}

export function formatCatalogMigrationRunReport(
  report: CatalogMigrationRunReport,
): string {
  const consumers = Object.values(report.metrics.consumerSlots).reduce(
    (total, counts) => ({
      rows: total.rows + counts.rows,
      updated: total.updated + counts.updated,
      reused: total.reused + counts.reused,
    }),
    { rows: 0, updated: 0, reused: 0 },
  );
  const migration = report.evidence.databaseMigration;
  const lines = [
    `Catalog migration ${report.mode}: ${report.status}`,
    `Database: ${report.evidence.databaseName}`,
    `Git: ${report.evidence.gitRevision}`,
    `Database migration: ${migration.id} ${migration.hash} (${migration.createdAt})`,
    `Checkpoint: after ${report.checkpoint.afterParentId}, active ${report.checkpoint.activeParentId ?? "none"}, next ${report.checkpoint.nextParentId ?? "none"}`,
    `Core families: ${report.metrics.core.familiesCreated} created, ${report.metrics.core.familiesReused} reused`,
    `Aliases: ${report.metrics.aliases.rows} rows, ${report.metrics.aliases.updated} updated, ${report.metrics.aliases.reused} reused`,
    `Observations: ${report.metrics.observations.rows} rows, ${report.metrics.observations.updated} updated, ${report.metrics.observations.reused} reused`,
    `Consumers: ${consumers.rows} slots, ${consumers.updated} updated, ${consumers.reused} reused`,
  ];
  if (report.failure) {
    const failure = report.failure;
    lines.push(
      failure.phase === "checkpoint"
        ? `Failure: ${failure.phase}/${failure.code}${failure.parentId === null ? "" : ` parent ${failure.parentId}`}`
        : `Failure: ${formatOperationFailure(failure)}`,
    );
    if (failure.phase === "checkpoint" && failure.originalFailure) {
      lines.push(
        `Original failure: ${formatOperationFailure(failure.originalFailure)}`,
      );
    }
  }
  return lines.join("\n");
}
