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
import { categoryEnum } from "./enums";
import { externalSites } from "./externalSites";

export const externalReviewArticles = pgTable(
  "review_article",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    // No-network legacy backfills leave source-derived metadata unknown.
    title: text("title"),
    issue: text("issue"),
    publishedAt: timestamp("published_at"),
    contentHash: text("content_hash"),
    fetchedAt: timestamp("fetched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("review_article_site_url_unq").on(
      table.externalSiteId,
      table.canonicalUrl,
    ),
  ],
);

export const externalReviews = pgTable(
  "review",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    category: categoryEnum("category"),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    // TODO(ratings): Drop this old Release reference after all deployed code
    // uses Bottle identity for external reviews.
    legacyReleaseId: bigint("release_id", { mode: "number" }),
    hidden: boolean("hidden").default(false),
    // Old normalized import values do not contribute to current summaries.
    // TODO(ratings): Drop this column after confirming no maintenance task reads it.
    legacyNormalizedScore: integer("rating"),
    articleId: bigint("article_id", { mode: "number" })
      .references(() => externalReviewArticles.id, { onDelete: "cascade" })
      .notNull(),
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
    uniqueIndex("review_article_source_key_unq").on(
      table.articleId,
      table.sourceKey,
    ),
    index("review_bottle_idx").on(table.bottleId),
    index("review_article_idx").on(table.articleId),
    index("review_release_idx").on(table.legacyReleaseId),
    check(
      "review_rating_check",
      sql`${table.legacyNormalizedScore} IS NULL OR ${table.legacyNormalizedScore} BETWEEN 0 AND 100`,
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

export const externalReviewArticlesRelations = relations(
  externalReviewArticles,
  ({ many, one }) => ({
    externalSite: one(externalSites, {
      fields: [externalReviewArticles.externalSiteId],
      references: [externalSites.id],
    }),
    externalReviews: many(externalReviews),
  }),
);

export const externalReviewsRelations = relations(
  externalReviews,
  ({ one }) => ({
    bottle: one(bottles, {
      fields: [externalReviews.bottleId],
      references: [bottles.id],
    }),
    article: one(externalReviewArticles, {
      fields: [externalReviews.articleId],
      references: [externalReviewArticles.id],
    }),
  }),
);

export type ExternalReviewArticle = typeof externalReviewArticles.$inferSelect;
export type NewExternalReviewArticle =
  typeof externalReviewArticles.$inferInsert;
export type ExternalReview = typeof externalReviews.$inferSelect;
export type NewExternalReview = typeof externalReviews.$inferInsert;
