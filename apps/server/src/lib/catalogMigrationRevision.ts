import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { fileURLToPath } from "node:url";
import { db, type AnyConnection, type AnyTransaction } from "../db";
import {
  CatalogMigrationRevisionEvidenceSchema,
  type CatalogMigrationRevisionEvidence,
} from "../schemas/catalogMigrationApply";

export type CatalogMigrationRevisionErrorCode =
  | "invalid_git_revision"
  | "missing_local_migration"
  | "missing_applied_migration"
  | "migration_revision_mismatch";

export class CatalogMigrationRevisionError extends Error {
  constructor(
    readonly code: CatalogMigrationRevisionErrorCode,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(`Catalog migration revision check failed (${code}).`, options);
    this.name = "CatalogMigrationRevisionError";
  }
}

const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../migrations", import.meta.url),
);

/**
 * Validates revision evidence on a caller-owned transaction. Migration apply
 * uses this only after acquiring its complete fixed-order table lock set.
 */
export async function loadCatalogMigrationRevisionEvidenceInTransaction(
  gitRevision: string,
  tx: AnyTransaction,
  migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
): Promise<CatalogMigrationRevisionEvidence> {
  const gitResult =
    CatalogMigrationRevisionEvidenceSchema.shape.gitRevision.safeParse(
      gitRevision,
    );
  if (!gitResult.success) {
    throw new CatalogMigrationRevisionError("invalid_git_revision");
  }

  let localMigrations: ReturnType<typeof readMigrationFiles>;
  try {
    localMigrations = readMigrationFiles({ migrationsFolder });
  } catch (error) {
    throw new CatalogMigrationRevisionError(
      "missing_local_migration",
      {},
      { cause: error },
    );
  }
  const candidate = localMigrations.at(-1);
  if (!candidate) {
    throw new CatalogMigrationRevisionError("missing_local_migration");
  }

  const databaseResult = await tx.execute<{ databaseName: string }>(sql`
    SELECT current_database() AS "databaseName"
  `);
  const migrationResult = await tx.execute<{
    id: number;
    hash: string;
    createdAt: string;
  }>(sql`
    SELECT id, hash, created_at AS "createdAt"
    FROM "__drizzle_migrations"
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);
  const databaseName = databaseResult.rows[0]?.databaseName;
  const applied = migrationResult.rows[0];
  if (!databaseName) {
    throw new CatalogMigrationRevisionError("missing_applied_migration", {
      reason: "database_name_missing",
    });
  }
  if (!applied) {
    throw new CatalogMigrationRevisionError("missing_applied_migration");
  }
  const appliedCreatedAt = Number(applied.createdAt);
  if (
    applied.hash !== candidate.hash ||
    appliedCreatedAt !== candidate.folderMillis
  ) {
    throw new CatalogMigrationRevisionError("migration_revision_mismatch", {
      appliedHash: applied.hash,
      appliedCreatedAt,
      candidateHash: candidate.hash,
      candidateCreatedAt: candidate.folderMillis,
    });
  }

  return CatalogMigrationRevisionEvidenceSchema.parse({
    gitRevision: gitResult.data,
    databaseName,
    databaseMigration: {
      id: applied.id,
      hash: applied.hash,
      createdAt: appliedCreatedAt,
    },
  });
}

/** Validates the supplied Git SHA and attests that applied DB migrations match. */
export async function loadCatalogMigrationRevisionEvidence(
  gitRevision: string,
  database: AnyConnection = db,
  migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
): Promise<CatalogMigrationRevisionEvidence> {
  return await database.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return await loadCatalogMigrationRevisionEvidenceInTransaction(
      gitRevision,
      tx,
      migrationsFolder,
    );
  });
}
