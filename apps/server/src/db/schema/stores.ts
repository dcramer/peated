import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottleReleases, bottles } from "./bottles";
import { externalSites } from "./externalSites";
import { users } from "./users";

export const currencyEnum = pgEnum("currency", ["usd", "gbp", "eur"]);
export const storePriceMatchProposalStatusEnum = pgEnum(
  "store_price_match_proposal_status",
  ["verified", "pending_review", "approved", "ignored", "errored"],
);
export const storePriceMatchProposalTypeEnum = pgEnum(
  "store_price_match_proposal_type",
  ["match_existing", "create_new", "correction", "no_match"],
);
export const storePriceMatchCreationTargetEnum = pgEnum(
  "store_price_match_creation_target",
  ["bottle", "release", "bottle_and_release"],
);
export const storePriceMatchRetryRunKindEnum = pgEnum(
  "store_price_match_retry_run_kind",
  ["create_new", "match_existing", "correction", "errored"],
);
export const storePriceMatchRetryRunModeEnum = pgEnum(
  "store_price_match_retry_run_mode",
  ["no_web", "full"],
);
export const storePriceMatchRetryRunStatusEnum = pgEnum(
  "store_price_match_retry_run_status",
  ["pending", "running", "completed", "failed", "canceled"],
);
export const storePriceMatchRetryRunItemStatusEnum = pgEnum(
  "store_price_match_retry_run_item_status",
  ["pending", "processing", "completed", "skipped", "failed"],
);

export const storePrices = pgTable(
  "store_price",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id)
      .notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id,
    ),
    hidden: boolean("hidden").default(false),
    price: integer("price").notNull(),
    currency: currencyEnum("currency").notNull(),
    volume: integer("volume").notNull(),
    url: text("url").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("store_price_unq_name").using(
      "btree",
      table.externalSiteId,
      sql`LOWER(${table.name})`,
      table.volume,
    ),
    index("store_price_bottle_idx").on(table.bottleId),
    index("store_price_release_idx").on(table.releaseId),
  ],
);

export const storePricesRelations = relations(storePrices, ({ one }) => ({
  bottle: one(bottles, {
    fields: [storePrices.bottleId],
    references: [bottles.id],
  }),
  release: one(bottleReleases, {
    fields: [storePrices.releaseId],
    references: [bottleReleases.id],
  }),
  externalSite: one(externalSites, {
    fields: [storePrices.externalSiteId],
    references: [externalSites.id],
  }),
}));

export type StorePrice = typeof storePrices.$inferSelect;
export type NewStorePrice = typeof storePrices.$inferInsert;

export const storePriceHistories = pgTable(
  "store_price_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    priceId: bigint("price_id", { mode: "number" })
      .references(() => storePrices.id)
      .notNull(),
    price: integer("price").notNull(),
    currency: currencyEnum("currency").default("usd").notNull(),
    volume: integer("volume").notNull(),
    date: date("date").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("store_price_history_unq").on(
      table.priceId,
      table.volume,
      table.date,
    ),
  ],
);

export const storePriceHistoriesRelations = relations(
  storePriceHistories,
  ({ one }) => ({
    price: one(storePrices, {
      fields: [storePriceHistories.priceId],
      references: [storePrices.id],
    }),
  }),
);

export type StorePriceHistory = typeof storePriceHistories.$inferSelect;
export type NewStorePriceHistory = typeof storePriceHistories.$inferInsert;

export const storePriceMatchProposals = pgTable(
  "store_price_match_proposal",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    priceId: bigint("price_id", { mode: "number" })
      .references(() => storePrices.id, { onDelete: "cascade" })
      .notNull(),
    status: storePriceMatchProposalStatusEnum("status")
      .default("pending_review")
      .notNull(),
    proposalType: storePriceMatchProposalTypeEnum("proposal_type").notNull(),
    confidence: integer("confidence"),
    currentBottleId: bigint("current_bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    currentReleaseId: bigint("current_release_id", {
      mode: "number",
    }).references(() => bottleReleases.id),
    suggestedBottleId: bigint("suggested_bottle_id", {
      mode: "number",
    }).references(() => bottles.id),
    suggestedReleaseId: bigint("suggested_release_id", {
      mode: "number",
    }).references(() => bottleReleases.id),
    parentBottleId: bigint("parent_bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    creationTarget: storePriceMatchCreationTargetEnum("creation_target"),
    candidateBottles: jsonb("candidate_bottles")
      .$type<Record<string, unknown>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    extractedLabel: jsonb("extracted_label").$type<Record<string, unknown>>(),
    proposedBottle: jsonb("proposed_bottle").$type<Record<string, unknown>>(),
    proposedRelease: jsonb("proposed_release").$type<Record<string, unknown>>(),
    searchEvidence: jsonb("search_evidence")
      .$type<Record<string, unknown>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    automationAssessment: jsonb("automation_assessment").$type<
      Record<string, unknown>
    >(),
    rationale: text("rationale"),
    model: text("model"),
    error: text("error"),
    lastEvaluatedAt: timestamp("last_evaluated_at"),
    enteredQueueAt: timestamp("entered_queue_at"),
    processingToken: text("processing_token"),
    processingQueuedAt: timestamp("processing_queued_at"),
    processingExpiresAt: timestamp("processing_expires_at"),
    reviewedById: bigint("reviewed_by_id", { mode: "number" }).references(
      () => users.id,
    ),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("store_price_match_proposal_price_idx").on(table.priceId),
    index("store_price_match_proposal_status_idx").on(table.status),
    index("store_price_match_proposal_type_idx").on(table.proposalType),
    index("store_price_match_proposal_current_bottle_idx").on(
      table.currentBottleId,
    ),
    index("store_price_match_proposal_current_release_idx").on(
      table.currentReleaseId,
    ),
    index("store_price_match_proposal_processing_expires_idx").on(
      table.processingExpiresAt,
    ),
    index("store_price_match_proposal_entered_queue_idx").on(
      table.enteredQueueAt,
    ),
    index("store_price_match_proposal_suggested_bottle_idx").on(
      table.suggestedBottleId,
    ),
    index("store_price_match_proposal_suggested_release_idx").on(
      table.suggestedReleaseId,
    ),
    index("store_price_match_proposal_parent_bottle_idx").on(
      table.parentBottleId,
    ),
    index("store_price_match_proposal_reviewed_by_idx").on(table.reviewedById),
  ],
);

export const storePriceMatchProposalsRelations = relations(
  storePriceMatchProposals,
  ({ one }) => ({
    price: one(storePrices, {
      fields: [storePriceMatchProposals.priceId],
      references: [storePrices.id],
    }),
    currentBottle: one(bottles, {
      fields: [storePriceMatchProposals.currentBottleId],
      references: [bottles.id],
    }),
    currentRelease: one(bottleReleases, {
      fields: [storePriceMatchProposals.currentReleaseId],
      references: [bottleReleases.id],
    }),
    suggestedBottle: one(bottles, {
      fields: [storePriceMatchProposals.suggestedBottleId],
      references: [bottles.id],
    }),
    suggestedRelease: one(bottleReleases, {
      fields: [storePriceMatchProposals.suggestedReleaseId],
      references: [bottleReleases.id],
    }),
    parentBottle: one(bottles, {
      fields: [storePriceMatchProposals.parentBottleId],
      references: [bottles.id],
      relationName: "store_price_match_parent_bottle",
    }),
    reviewedBy: one(users, {
      fields: [storePriceMatchProposals.reviewedById],
      references: [users.id],
    }),
  }),
);

export type StorePriceMatchProposal =
  typeof storePriceMatchProposals.$inferSelect;
export type NewStorePriceMatchProposal =
  typeof storePriceMatchProposals.$inferInsert;

export const storePriceMatchRetryRuns = pgTable(
  "store_price_match_retry_run",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    query: text("query").default("").notNull(),
    kind: storePriceMatchRetryRunKindEnum("kind"),
    mode: storePriceMatchRetryRunModeEnum("mode").default("no_web").notNull(),
    status: storePriceMatchRetryRunStatusEnum("status")
      .default("pending")
      .notNull(),
    matchedCount: integer("matched_count").default(0).notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    resolvedCount: integer("resolved_count").default(0).notNull(),
    reviewableCount: integer("reviewable_count").default(0).notNull(),
    erroredCount: integer("errored_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    error: text("error"),
    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
    ),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    cancelRequestedAt: timestamp("cancel_requested_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("store_price_match_retry_run_status_idx").on(table.status),
    index("store_price_match_retry_run_created_by_idx").on(table.createdById),
    index("store_price_match_retry_run_created_at_idx").on(table.createdAt),
  ],
);

export const storePriceMatchRetryRunItems = pgTable(
  "store_price_match_retry_run_item",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: bigint("run_id", { mode: "number" })
      .references(() => storePriceMatchRetryRuns.id, { onDelete: "cascade" })
      .notNull(),
    proposalId: bigint("proposal_id", { mode: "number" })
      .references(() => storePriceMatchProposals.id, { onDelete: "cascade" })
      .notNull(),
    priceId: bigint("price_id", { mode: "number" })
      .references(() => storePrices.id, { onDelete: "cascade" })
      .notNull(),
    status: storePriceMatchRetryRunItemStatusEnum("status")
      .default("pending")
      .notNull(),
    resultStatus: storePriceMatchProposalStatusEnum("result_status"),
    error: text("error"),
    attempts: integer("attempts").default(0).notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("store_price_match_retry_run_item_unq").on(
      table.runId,
      table.proposalId,
    ),
    index("store_price_match_retry_run_item_run_status_idx").on(
      table.runId,
      table.status,
    ),
    index("store_price_match_retry_run_item_proposal_idx").on(table.proposalId),
    index("store_price_match_retry_run_item_price_idx").on(table.priceId),
  ],
);

export const storePriceMatchRetryRunsRelations = relations(
  storePriceMatchRetryRuns,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [storePriceMatchRetryRuns.createdById],
      references: [users.id],
    }),
    items: many(storePriceMatchRetryRunItems),
  }),
);

export const storePriceMatchRetryRunItemsRelations = relations(
  storePriceMatchRetryRunItems,
  ({ one }) => ({
    run: one(storePriceMatchRetryRuns, {
      fields: [storePriceMatchRetryRunItems.runId],
      references: [storePriceMatchRetryRuns.id],
    }),
    proposal: one(storePriceMatchProposals, {
      fields: [storePriceMatchRetryRunItems.proposalId],
      references: [storePriceMatchProposals.id],
    }),
    price: one(storePrices, {
      fields: [storePriceMatchRetryRunItems.priceId],
      references: [storePrices.id],
    }),
  }),
);

export type StorePriceMatchRetryRun =
  typeof storePriceMatchRetryRuns.$inferSelect;
export type NewStorePriceMatchRetryRun =
  typeof storePriceMatchRetryRuns.$inferInsert;
export type StorePriceMatchRetryRunItem =
  typeof storePriceMatchRetryRunItems.$inferSelect;
export type NewStorePriceMatchRetryRunItem =
  typeof storePriceMatchRetryRunItems.$inferInsert;
