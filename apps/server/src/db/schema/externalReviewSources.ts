import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  pgEnum,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";
import { externalSites } from "./externalSites";

export const externalReviewPublicationModeEnum = pgEnum(
  "external_review_publication_mode",
  ["disabled", "review_only", "automatic"],
);

/**
 * Owns the runtime controls for processing and displaying publisher external reviews.
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
    allowLlmProcessing: boolean("allow_llm_processing")
      .default(false)
      .notNull(),
    allowScoreDisplay: boolean("allow_score_display").default(false).notNull(),
    allowSummaryDisplay: boolean("allow_summary_display")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "external_review_source_policy_disabled_check",
      sql`${table.publicationMode} <> 'disabled' OR (
        NOT ${table.allowLlmProcessing}
        AND NOT ${table.allowScoreDisplay}
        AND NOT ${table.allowSummaryDisplay}
      )`,
    ),
    check(
      "external_review_source_policy_summary_check",
      sql`NOT ${table.allowSummaryDisplay} OR ${table.allowLlmProcessing}`,
    ),
  ],
);

export type ExternalReviewSourcePolicy =
  typeof externalReviewSourcePolicies.$inferSelect;
export type NewExternalReviewSourcePolicy =
  typeof externalReviewSourcePolicies.$inferInsert;
