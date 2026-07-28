import { sql } from "drizzle-orm";
import type { AnyDatabase } from "../db";
import {
  CatalogMigrationDatabaseEvidenceSchema,
  type CatalogMigrationDatabaseEvidence,
} from "../schemas/catalogMigrationDatabaseIdentity";

type DatabaseEvidenceRow = {
  databaseName: string;
  systemIdentifier: string;
  isInRecovery: boolean;
  serverAddress: string | null;
  serverPort: number | null;
  currentUser: string;
};

export type CatalogMigrationDatabaseEvidenceErrorCode =
  | "database_identity_permission_denied"
  | "database_identity_unavailable"
  | "database_in_recovery";

const ERROR_MESSAGES: Record<
  CatalogMigrationDatabaseEvidenceErrorCode,
  string
> = {
  database_identity_permission_denied:
    "Catalog migration database identity permission denied. Grant the database role EXECUTE ON FUNCTION pg_control_system() and EXECUTE ON FUNCTION pg_is_in_recovery().",
  database_identity_unavailable:
    "Catalog migration database identity query failed. Inspect the underlying database or connection error and retry.",
  database_in_recovery:
    "Catalog migration requires a writable PostgreSQL primary, but this connection is in recovery.",
};

export class CatalogMigrationDatabaseEvidenceError extends Error {
  readonly requiredCapabilities: readonly string[];

  constructor(
    readonly code: CatalogMigrationDatabaseEvidenceErrorCode,
    options?: ErrorOptions,
  ) {
    super(ERROR_MESSAGES[code], options);
    this.name = "CatalogMigrationDatabaseEvidenceError";
    this.requiredCapabilities =
      code === "database_identity_permission_denied"
        ? [
            "EXECUTE ON FUNCTION pg_control_system()",
            "EXECUTE ON FUNCTION pg_is_in_recovery()",
          ]
        : [];
  }
}

function isPostgresPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42501"
  );
}

export async function loadCatalogMigrationDatabaseEvidence(
  database: AnyDatabase,
): Promise<CatalogMigrationDatabaseEvidence> {
  let result: { rows: DatabaseEvidenceRow[] };
  try {
    result = await database.execute<DatabaseEvidenceRow>(sql`
      SELECT
        current_database() AS "databaseName",
        control.system_identifier::text AS "systemIdentifier",
        pg_is_in_recovery() AS "isInRecovery",
        host(inet_server_addr()) AS "serverAddress",
        inet_server_port() AS "serverPort",
        current_user AS "currentUser"
      FROM pg_control_system() AS control
    `);
  } catch (error) {
    throw new CatalogMigrationDatabaseEvidenceError(
      isPostgresPermissionDenied(error)
        ? "database_identity_permission_denied"
        : "database_identity_unavailable",
      { cause: error },
    );
  }
  const evidence = result.rows[0];
  if (!evidence) {
    throw new CatalogMigrationDatabaseEvidenceError(
      "database_identity_unavailable",
      {
        cause: new Error("Database identity query returned no rows."),
      },
    );
  }
  if (evidence.isInRecovery) {
    throw new CatalogMigrationDatabaseEvidenceError("database_in_recovery");
  }
  return CatalogMigrationDatabaseEvidenceSchema.parse({
    identity: {
      databaseName: evidence.databaseName,
      systemIdentifier: evidence.systemIdentifier,
      isInRecovery: evidence.isInRecovery,
    },
    connection: {
      serverAddress: evidence.serverAddress,
      serverPort: evidence.serverPort,
      currentUser: evidence.currentUser,
    },
  });
}
