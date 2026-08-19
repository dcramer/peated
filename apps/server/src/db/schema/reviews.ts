import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottles } from "./bottles";
import { externalSites } from "./externalSites";

export const externalReviewDocuments = pgTable(
  "external_review_document",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    issue: text("issue"),
    publishedAt: timestamp("published_at"),
    contentHash: text("content_hash").notNull(),
    fetchedAt: timestamp("fetched_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("external_review_document_site_url_unq").on(
      table.externalSiteId,
      table.canonicalUrl,
    ),
  ],
);

export const reviews = pgTable(
  "review",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id)
      .notNull(),
    name: text("name").notNull(),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    // Retained compatibility field for safe migrations; do not use in new logic.
    legacyReleaseId: bigint("release_id", { mode: "number" }),
    hidden: boolean("hidden").default(false),
    // Normalized ratings are optional compatibility values on a 0-100 scale.
    rating: integer("rating"),
    issue: text("issue").notNull(),
    url: text("url").notNull(),
    documentId: bigint("document_id", { mode: "number" }).references(
      () => externalReviewDocuments.id,
      { onDelete: "cascade" },
    ),
    sourceKey: text("source_key"),
    reviewerName: text("reviewer_name"),
    nativeScoreValue: doublePrecision("native_score_value"),
    nativeScoreScale: doublePrecision("native_score_scale"),
    nativeScoreDisplay: text("native_score_display"),
    summary: text("summary"),
    summaryContentHash: text("summary_content_hash"),
    summaryModel: text("summary_model"),
    summaryPromptVersion: text("summary_prompt_version"),
    summaryGeneratedAt: timestamp("summary_generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("review_unq_name").using(
      "btree",
      table.externalSiteId,
      sql`LOWER(${table.name})`,
      table.issue,
    ),
    uniqueIndex("review_document_source_key_unq").on(
      table.documentId,
      table.sourceKey,
    ),
    index("review_bottle_idx").on(table.bottleId),
    index("review_document_idx").on(table.documentId),
    index("review_release_idx").on(table.legacyReleaseId),
    check(
      "review_rating_check",
      sql`${table.rating} IS NULL OR ${table.rating} BETWEEN 0 AND 100`,
    ),
    check(
      "review_native_score_check",
      sql`(
        ${table.nativeScoreValue} IS NULL
        AND ${table.nativeScoreScale} IS NULL
        AND ${table.nativeScoreDisplay} IS NULL
      ) OR (
        ${table.nativeScoreValue} IS NOT NULL
        AND ${table.nativeScoreScale} IS NOT NULL
        AND ${table.nativeScoreDisplay} IS NOT NULL
        AND ${table.nativeScoreValue} >= 0
        AND ${table.nativeScoreScale} > 0
        AND ${table.nativeScoreValue} <= ${table.nativeScoreScale}
      )`,
    ),
    check(
      "review_summary_provenance_check",
      sql`(
        ${table.summary} IS NULL
        AND ${table.summaryContentHash} IS NULL
        AND ${table.summaryModel} IS NULL
        AND ${table.summaryPromptVersion} IS NULL
        AND ${table.summaryGeneratedAt} IS NULL
      ) OR (
        ${table.summary} IS NOT NULL
        AND ${table.summaryContentHash} IS NOT NULL
        AND ${table.summaryModel} IS NOT NULL
        AND ${table.summaryPromptVersion} IS NOT NULL
        AND ${table.summaryGeneratedAt} IS NOT NULL
      )`,
    ),
  ],
);

export const externalReviewDocumentsRelations = relations(
  externalReviewDocuments,
  ({ many, one }) => ({
    externalSite: one(externalSites, {
      fields: [externalReviewDocuments.externalSiteId],
      references: [externalSites.id],
    }),
    observations: many(reviews),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  bottle: one(bottles, {
    fields: [reviews.bottleId],
    references: [bottles.id],
  }),
  store: one(externalSites, {
    fields: [reviews.externalSiteId],
    references: [externalSites.id],
  }),
  document: one(externalReviewDocuments, {
    fields: [reviews.documentId],
    references: [externalReviewDocuments.id],
  }),
}));

export type ExternalReviewDocument =
  typeof externalReviewDocuments.$inferSelect;
export type NewExternalReviewDocument =
  typeof externalReviewDocuments.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
