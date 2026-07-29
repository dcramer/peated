import { sql } from "drizzle-orm";
import { db, type AnyConnection } from "../db";
import {
  CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION,
  CatalogMigrationApprovalCandidateSchema,
  type CatalogMigrationApprovalCandidate,
} from "../schemas/catalogMigrationApply";
import { collectCatalogMigrationAudit } from "./catalogMigrationAudit";
import { loadCatalogMigrationDatabaseEvidence } from "./catalogMigrationDatabaseEvidence";
import { loadCatalogMigrationRevisionEvidenceInTransaction } from "./catalogMigrationRevision";

export async function loadCatalogMigrationApprovalCandidate(
  gitRevision: string,
  database: AnyConnection = db,
  migrationsFolder?: string,
): Promise<CatalogMigrationApprovalCandidate> {
  return await database.transaction(async (tx) => {
    await tx.execute(
      sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`,
    );
    const databaseEvidence = await loadCatalogMigrationDatabaseEvidence(tx);
    const audit = await collectCatalogMigrationAudit(tx, databaseEvidence);
    const revision = await loadCatalogMigrationRevisionEvidenceInTransaction(
      gitRevision,
      tx,
      migrationsFolder,
      databaseEvidence,
    );

    return CatalogMigrationApprovalCandidateSchema.parse({
      schemaVersion: CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION,
      audit,
      revision,
    });
  });
}
