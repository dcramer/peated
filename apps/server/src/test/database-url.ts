import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { basename, join } from "node:path";

const DEFAULT_TEST_DATABASE = "test_peated";
const MAX_DATABASE_NAME_LENGTH = 63;

/**
 * Returns the worktree folder name when `repoRoot` is a linked git worktree,
 * where `.git` is a file that points at the main checkout.
 */
export function linkedWorktreeName(repoRoot: string): string | null {
  try {
    return statSync(join(repoRoot, ".git")).isFile()
      ? basename(repoRoot)
      : null;
  } catch {
    return null;
  }
}

/**
 * Chooses the database backend tests use.
 *
 * Backend test isolation owns this rule: each linked worktree gets its own
 * copy of the default `test_peated`, so sessions on different branches do not
 * truncate, migrate, or disconnect each other's runs. Any other database name
 * is used as written. This runs when tools such as knip load the Vitest
 * config, so it never throws; `assertTestDatabaseName` checks the name when
 * tests run.
 */
export function testDatabaseUrl(
  databaseUrl: string | undefined,
  worktreeName: string | null,
): string | undefined {
  if (!databaseUrl || !worktreeName) return databaseUrl;

  const url = new URL(databaseUrl);
  if (url.pathname.replace(/^\//, "") !== DEFAULT_TEST_DATABASE) {
    return databaseUrl;
  }

  const suffix = worktreeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!suffix) return databaseUrl;

  let name = `${DEFAULT_TEST_DATABASE}_${suffix}`;
  if (name.length > MAX_DATABASE_NAME_LENGTH) {
    // Keep long names unique: a cut name could match another worktree's.
    const hash = createHash("sha256")
      .update(worktreeName)
      .digest("hex")
      .slice(0, 8);
    name = `${name.slice(0, MAX_DATABASE_NAME_LENGTH - hash.length - 1)}_${hash}`;
  }
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * Backend tests empty every table, so they refuse a database whose name does
 * not start with `test`. A `DATABASE_URL` left in the shell would otherwise
 * point tests at a dev database.
 */
export function assertTestDatabaseName(name: string): void {
  if (name.startsWith("test")) return;

  throw new Error(
    `Backend tests empty every table, so DATABASE_URL must name a database that starts with "test", not "${name}". ` +
      "Unset DATABASE_URL in your shell (`env -u DATABASE_URL`) or set it in apps/server/.env.test.local.",
  );
}
