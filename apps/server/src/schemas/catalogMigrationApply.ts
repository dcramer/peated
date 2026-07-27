import { z } from "zod";
import { CatalogMigrationAuditSchema } from "./catalogMigrationAudit";

export const CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION = 1 as const;
export const CATALOG_MIGRATION_APPLY_SCHEMA_VERSION = 2 as const;

export const CatalogMigrationDatabaseRevisionSchema = z.object({
  id: z.number().int().positive(),
  hash: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

export const CatalogMigrationRevisionEvidenceSchema = z.object({
  gitRevision: z.string().regex(/^[0-9a-f]{40}$/),
  databaseName: z.string().min(1),
  databaseMigration: CatalogMigrationDatabaseRevisionSchema,
});

export const CatalogMigrationApprovalCandidateSchema = z.object({
  schemaVersion: z.literal(CATALOG_MIGRATION_APPROVAL_CANDIDATE_SCHEMA_VERSION),
  audit: CatalogMigrationAuditSchema,
  revision: CatalogMigrationRevisionEvidenceSchema,
});

export const CatalogMigrationApprovalSchema = z.object({
  approvedBy: z.string().trim().min(1),
  approvedAt: z.string().datetime(),
});

export const CatalogMigrationApplyInputSchema = z.object({
  candidate: CatalogMigrationApprovalCandidateSchema,
  approval: CatalogMigrationApprovalSchema,
});

export const CATALOG_MIGRATION_CONSUMER_SLOTS = [
  "bottle_alias",
  "bottle_observation",
  "tasting",
  "review",
  "collection_bottle",
  "flight_bottle",
  "store_price",
  "incoming_bottle_decision_log",
  "store_price_match_proposal.current",
  "store_price_match_proposal.suggested",
  "store_price_match_attempt.current",
  "store_price_match_attempt.suggested",
] as const;

const CatalogMigrationConsumerBySlotSchema = z.object({
  bottle_alias: z.number().int().nonnegative(),
  bottle_observation: z.number().int().nonnegative(),
  tasting: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  collection_bottle: z.number().int().nonnegative(),
  flight_bottle: z.number().int().nonnegative(),
  store_price: z.number().int().nonnegative(),
  incoming_bottle_decision_log: z.number().int().nonnegative(),
  "store_price_match_proposal.current": z.number().int().nonnegative(),
  "store_price_match_proposal.suggested": z.number().int().nonnegative(),
  "store_price_match_attempt.current": z.number().int().nonnegative(),
  "store_price_match_attempt.suggested": z.number().int().nonnegative(),
});

export const CatalogMigrationConsumerResultSchema = z
  .object({
    bySlot: CatalogMigrationConsumerBySlotSchema,
    total: z.number().int().nonnegative(),
  })
  .superRefine(({ bySlot, total }, context) => {
    const slotTotal = Object.values(bySlot).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (slotTotal !== total) {
      context.addIssue({
        code: "custom",
        message: "consumer total must equal the sum of bySlot counts",
        path: ["total"],
      });
    }
  });

const CatalogMigrationApplyCountsSchema = z.object({
  parents: z.number().int().nonnegative(),
  groups: z.number().int().nonnegative(),
  parentBottlesAssigned: z.number().int().nonnegative(),
  releases: z.number().int().nonnegative(),
  promotedBottles: z.number().int().nonnegative(),
  promotionMappings: z.number().int().nonnegative(),
  canonicalAliasesChanged: z.number().int().nonnegative(),
  canonicalAliasesReused: z.number().int().nonnegative(),
  groupDistillers: z.number().int().nonnegative(),
  bottleDistillers: z.number().int().nonnegative(),
  bottleTags: z.number().int().nonnegative(),
  bottleFlavorProfiles: z.number().int().nonnegative(),
  bottleStatsRecomputed: z.number().int().nonnegative(),
  groupStatsRecomputed: z.number().int().nonnegative(),
  consumers: CatalogMigrationConsumerResultSchema,
});

export const CatalogMigrationApplyResultSchema = z.object({
  schemaVersion: z.literal(CATALOG_MIGRATION_APPLY_SCHEMA_VERSION),
  status: z.enum(["applied", "already_complete"]),
  approvedAuditGeneratedAt: z.string().datetime(),
  revision: CatalogMigrationRevisionEvidenceSchema,
  approval: CatalogMigrationApprovalSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  counts: CatalogMigrationApplyCountsSchema,
  postflightAudit: CatalogMigrationAuditSchema,
});

export type CatalogMigrationRevisionEvidence = z.infer<
  typeof CatalogMigrationRevisionEvidenceSchema
>;
export type CatalogMigrationApprovalCandidate = z.infer<
  typeof CatalogMigrationApprovalCandidateSchema
>;
export type CatalogMigrationApproval = z.infer<
  typeof CatalogMigrationApprovalSchema
>;
export type CatalogMigrationApplyInput = z.infer<
  typeof CatalogMigrationApplyInputSchema
>;
export type CatalogMigrationConsumerSlot =
  (typeof CATALOG_MIGRATION_CONSUMER_SLOTS)[number];
export type CatalogMigrationConsumerResult = z.infer<
  typeof CatalogMigrationConsumerResultSchema
>;
export type CatalogMigrationApplyResult = z.infer<
  typeof CatalogMigrationApplyResultSchema
>;
