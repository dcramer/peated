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
 * Backend test isolation owns two rules here. Tests empty every table, so the
 * database name must start with `test`; a `DATABASE_URL` left in the shell
 * would otherwise point tests at a dev database. Each linked worktree gets its
 * own copy of the default `test_peated`, so sessions on different branches do
 * not truncate, migrate, or disconnect each other's runs. Any other test
 * database name, such as one set in `.env.test.local`, is used as written.
 */
export function testDatabaseUrl(
  databaseUrl: string | undefined,
  worktreeName: string | null,
): string | undefined {
  if (!databaseUrl) return databaseUrl;

  const url = new URL(databaseUrl);
  const name = url.pathname.replace(/^\//, "");
  if (!name.startsWith("test")) {
    throw new Error(
      `Backend tests empty every table, so DATABASE_URL must name a database that starts with "test", not "${name}". ` +
        "Unset DATABASE_URL in your shell (`env -u DATABASE_URL`) or set it in apps/server/.env.test.local.",
    );
  }
  if (name !== DEFAULT_TEST_DATABASE || !worktreeName) return databaseUrl;

  const suffix = worktreeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!suffix) return databaseUrl;

  url.pathname = `/${`${DEFAULT_TEST_DATABASE}_${suffix}`.slice(0, MAX_DATABASE_NAME_LENGTH)}`;
  return url.toString();
}
