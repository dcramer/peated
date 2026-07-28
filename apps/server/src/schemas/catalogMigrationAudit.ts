import { z } from "zod";
import { CatalogMigrationDatabaseEvidenceSchema } from "./catalogMigrationDatabaseIdentity";

export const CATALOG_MIGRATION_AUDIT_SCHEMA_VERSION = 4 as const;

export const CatalogMigrationLegacySummarySchema = z.object({
  totalParents: z.number().int().gte(0),
  parentsWithZeroReleases: z.number().int().gte(0),
  parentsWithOneRelease: z.number().int().gte(0),
  parentsWithMultipleReleases: z.number().int().gte(0),
  retiredParents: z.number().int().gte(0),
  retiredParentsWithReleases: z.number().int().gte(0),
  totalReleases: z.number().int().gte(0),
  parentsWithReleaseLikeFields: z.number().int().gte(0),
  childParentAgeConflicts: z.number().int().gte(0),
  orphanReleases: z.number().int().gte(0),
  missingParentCreators: z.number().int().gte(0),
  missingReleaseCreators: z.number().int().gte(0),
  missingParentAliases: z.number().int().gte(0),
  missingReleaseAliases: z.number().int().gte(0),
  missingParentImages: z.number().int().gte(0),
  missingReleaseImages: z.number().int().gte(0),
});

export const CatalogMigrationReferenceSummarySchema = z.object({
  surface: z.string().min(1),
  totalRows: z.number().int().gte(0),
  genericRows: z.number().int().gte(0),
  releaseRows: z.number().int().gte(0),
  unassignedRows: z.number().int().gte(0),
  missingBottleReferences: z.number().int().gte(0),
  missingReleaseReferences: z.number().int().gte(0),
  mismatchedPairs: z.number().int().gte(0),
  invalidRows: z.number().int().gte(0),
});

export const CatalogMigrationCollisionSchema = z.object({
  type: z.enum([
    "release_full_name_vs_bottle",
    "release_full_name_vs_alias",
    "release_alias_vs_bottle",
    "release_full_name_case_duplicate",
  ]),
  name: z.string(),
  releaseId: z.number().int().positive(),
  otherReleaseId: z.number().int().positive().nullable(),
  bottleId: z.number().int().positive().nullable(),
});

export const CatalogMigrationMappingSummarySchema = z.object({
  tablePresent: z.boolean(),
  totalLegacyReleases: z.number().int().gte(0),
  totalMappings: z.number().int().gte(0),
  mappedReleases: z.number().int().gte(0),
  unmappedReleases: z.number().int().gte(0),
  completedMappings: z.number().int().gte(0),
  pendingMappings: z.number().int().gte(0),
  failedMappings: z.number().int().gte(0),
  partialMappings: z.number().int().gte(0),
  invalidStatusMappings: z.number().int().gte(0),
  duplicateReleaseMappings: z.number().int().gte(0),
  missingLegacyReleases: z.number().int().gte(0),
  missingPromotedBottles: z.number().int().gte(0),
});

export const CatalogMigrationAuditSchema = z.object({
  schemaVersion: z.literal(CATALOG_MIGRATION_AUDIT_SCHEMA_VERSION),
  generatedAt: z.string().datetime(),
  databaseEvidence: CatalogMigrationDatabaseEvidenceSchema,
  legacyCatalog: CatalogMigrationLegacySummarySchema,
  references: z.array(CatalogMigrationReferenceSummarySchema),
  collisions: z.object({
    count: z.number().int().gte(0),
    items: z.array(CatalogMigrationCollisionSchema),
  }),
  promotionMappings: CatalogMigrationMappingSummarySchema,
  blockingIssueCount: z.number().int().gte(0),
  warningCount: z.number().int().gte(0),
});

export type CatalogMigrationLegacySummary = z.infer<
  typeof CatalogMigrationLegacySummarySchema
>;
export type CatalogMigrationReferenceSummary = z.infer<
  typeof CatalogMigrationReferenceSummarySchema
>;
export type CatalogMigrationCollision = z.infer<
  typeof CatalogMigrationCollisionSchema
>;
export type CatalogMigrationMappingSummary = z.infer<
  typeof CatalogMigrationMappingSummarySchema
>;
export type CatalogMigrationAudit = z.infer<typeof CatalogMigrationAuditSchema>;
