import { z } from "zod";
import { CatalogMigrationAuditSchema } from "./catalogMigrationAudit";
import {
  CatalogMigrationDatabaseEvidenceSchema,
  sameCatalogMigrationDatabaseEvidence,
} from "./catalogMigrationDatabaseIdentity";

export const CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION = 3 as const;

export const CatalogMigrationDatabaseRevisionSchema = z.object({
  id: z.number().int().positive(),
  hash: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

export const CatalogMigrationRevisionEvidenceSchema = z.object({
  gitRevision: z.string().regex(/^[0-9a-f]{40}$/),
  databaseEvidence: CatalogMigrationDatabaseEvidenceSchema,
  databaseMigration: CatalogMigrationDatabaseRevisionSchema,
});

export const CatalogMigrationApprovalCandidateSchema = z
  .object({
    schemaVersion: z.literal(
      CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION,
    ),
    audit: CatalogMigrationAuditSchema,
    revision: CatalogMigrationRevisionEvidenceSchema,
  })
  .superRefine(({ audit, revision }, context) => {
    if (
      !sameCatalogMigrationDatabaseEvidence(
        audit.databaseEvidence,
        revision.databaseEvidence,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "audit and revision database evidence must match exactly because they share one transaction",
        path: ["revision", "databaseEvidence"],
      });
    }
  });

export type CatalogMigrationRevisionEvidence = z.infer<
  typeof CatalogMigrationRevisionEvidenceSchema
>;
export type CatalogMigrationApprovalCandidate = z.infer<
  typeof CatalogMigrationApprovalCandidateSchema
>;
