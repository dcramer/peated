import type { AnyDatabase } from "../db";
import {
  CatalogMigrationDatabaseEvidenceError,
  loadCatalogMigrationDatabaseEvidence,
} from "./catalogMigrationDatabaseEvidence";

function databaseReturning(row: Record<string, unknown>): AnyDatabase {
  return {
    execute: vi.fn().mockResolvedValue({ rows: [row] }),
  } as unknown as AnyDatabase;
}

describe("loadCatalogMigrationDatabaseEvidence", () => {
  test("reports exact EXECUTE guidance only for PostgreSQL permission errors", async () => {
    const cause = Object.assign(
      new Error("permission denied for function pg_control_system"),
      { code: "42501" },
    );
    const database = {
      execute: vi.fn().mockRejectedValue(cause),
    } as unknown as AnyDatabase;

    const result = loadCatalogMigrationDatabaseEvidence(database);

    await expect(result).rejects.toMatchObject({
      name: "CatalogMigrationDatabaseEvidenceError",
      code: "database_identity_permission_denied",
      cause,
      requiredCapabilities: [
        "EXECUTE ON FUNCTION pg_control_system()",
        "EXECUTE ON FUNCTION pg_is_in_recovery()",
      ],
    });
    await expect(result).rejects.toThrow(
      "Grant the database role EXECUTE ON FUNCTION pg_control_system() and EXECUTE ON FUNCTION pg_is_in_recovery().",
    );
  });

  test("preserves generic query failures without blaming permissions", async () => {
    const cause = Object.assign(new Error("connection reset"), {
      code: "ECONNRESET",
    });
    const database = {
      execute: vi.fn().mockRejectedValue(cause),
    } as unknown as AnyDatabase;

    const error = await loadCatalogMigrationDatabaseEvidence(database).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CatalogMigrationDatabaseEvidenceError);
    expect(error).toMatchObject({
      code: "database_identity_unavailable",
      cause,
      requiredCapabilities: [],
    });
    expect((error as Error).message).not.toContain("EXECUTE");
  });

  test("rejects a recovery server with an explicit primary requirement", async () => {
    const database = databaseReturning({
      databaseName: "peated",
      systemIdentifier: "7312345678901234567",
      isInRecovery: true,
      serverAddress: "10.0.0.2",
      serverPort: 5432,
      currentUser: "catalog_writer",
    });

    await expect(
      loadCatalogMigrationDatabaseEvidence(database),
    ).rejects.toMatchObject({
      code: "database_in_recovery",
      message:
        "Catalog migration requires a writable PostgreSQL primary, but this connection is in recovery.",
      requiredCapabilities: [],
    });
  });
});
