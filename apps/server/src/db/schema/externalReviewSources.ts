import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { actors } from "./actors";
import { externalSites } from "./externalSites";

export const externalReviewPublicationModeEnum = pgEnum(
  "external_review_publication_mode",
  ["disabled", "review_only", "automatic"],
);

/**
 * Owns the runtime authorization for acquiring and displaying publisher
 * reviews. A robots rule can further restrict fetching but never grants a
 * capability absent from this policy.
 */
export const externalReviewSourcePolicies = pgTable(
  "external_review_source_policy",
  {
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .primaryKey()
      .references(() => externalSites.id, { onDelete: "cascade" }),
    publicationMode: externalReviewPublicationModeEnum("publication_mode")
      .default("disabled")
      .notNull(),
    allowFetching: boolean("allow_fetching").default(false).notNull(),
    allowLlmProcessing: boolean("allow_llm_processing")
      .default(false)
      .notNull(),
    allowScoreDisplay: boolean("allow_score_display").default(false).notNull(),
    allowSummaryDisplay: boolean("allow_summary_display")
      .default(false)
      .notNull(),
    policyEvidenceUrl: text("policy_evidence_url"),
    approvalReference: text("approval_reference"),
    reviewedAt: timestamp("reviewed_at"),
    approvedByActorId: bigint("approved_by_actor_id", {
      mode: "number",
    }).references(() => actors.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "external_review_source_policy_disabled_check",
      sql`${table.publicationMode} <> 'disabled' OR (
        NOT ${table.allowFetching}
        AND NOT ${table.allowLlmProcessing}
        AND NOT ${table.allowScoreDisplay}
        AND NOT ${table.allowSummaryDisplay}
      )`,
    ),
    check(
      "external_review_source_policy_summary_check",
      sql`NOT ${table.allowSummaryDisplay} OR ${table.allowLlmProcessing}`,
    ),
    check(
      "external_review_source_policy_approval_check",
      sql`${table.publicationMode} = 'disabled' OR (
        ${table.allowFetching}
        AND ${table.policyEvidenceUrl} IS NOT NULL
        AND ${table.approvalReference} IS NOT NULL
        AND ${table.reviewedAt} IS NOT NULL
        AND ${table.approvedByActorId} IS NOT NULL
      )`,
    ),
  ],
);

export const externalReviewSourcePoliciesRelations = relations(
  externalReviewSourcePolicies,
  ({ one }) => ({
    externalSite: one(externalSites, {
      fields: [externalReviewSourcePolicies.externalSiteId],
      references: [externalSites.id],
    }),
    approvedByActor: one(actors, {
      fields: [externalReviewSourcePolicies.approvedByActorId],
      references: [actors.id],
    }),
  }),
);

export type ExternalReviewSourcePolicy =
  typeof externalReviewSourcePolicies.$inferSelect;
export type NewExternalReviewSourcePolicy =
  typeof externalReviewSourcePolicies.$inferInsert;
