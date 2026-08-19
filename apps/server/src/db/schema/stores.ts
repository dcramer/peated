import type { BottleExtractedDetails } from "@peated/bottle-classifier/contract";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { bottles } from "./bottles";
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
export const legacyStorePriceMatchCreationTargetEnum = pgEnum(
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
    externalProductId: text("external_product_id"),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    barcode: varchar("barcode", { length: 14 }),
    // Provider-owned facts are normalized classifier evidence, never raw
    // provider payloads or canonical catalog authority.
    sourceBottleIdentity: jsonb(
      "source_bottle_identity",
    ).$type<BottleExtractedDetails>(),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    // Retained compatibility field for safe migrations; do not use in new logic.
    legacyReleaseId: bigint("release_id", { mode: "number" }),
    hidden: boolean("hidden").default(false),
    price: integer("price").notNull(),
    currency: currencyEnum("currency").notNull(),
    volume: integer("volume").notNull(),
    url: text("url").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("store_price_site_external_product_unq")
      .on(table.externalSiteId, table.externalProductId)
      .where(sql`${table.externalProductId} IS NOT NULL`),
    index("store_price_site_name_volume_idx").using(
      "btree",
      table.externalSiteId,
      sql`LOWER(${table.name})`,
      table.volume,
    ),
    index("store_price_bottle_idx").on(table.bottleId),
    index("store_price_release_idx").on(table.legacyReleaseId),
    check(
      "store_price_barcode_check",
      sql`${table.barcode} IS NULL OR (${table.barcode} ~ '^[0-9]+$' AND char_length(${table.barcode}) IN (8, 12, 13, 14))`,
    ),
  ],
);

export const storePricesRelations = relations(storePrices, ({ one }) => ({
  bottle: one(bottles, {
    fields: [storePrices.bottleId],
    references: [bottles.id],
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
    // Retained compatibility columns for safe migrations; new logic uses Bottle IDs.
    legacyCurrentReleaseId: bigint("current_release_id", { mode: "number" }),
    suggestedBottleId: bigint("suggested_bottle_id", {
      mode: "number",
    }).references(() => bottles.id),
    legacySuggestedReleaseId: bigint("suggested_release_id", {
      mode: "number",
    }),
    legacyParentBottleId: bigint("parent_bottle_id", {
      mode: "number",
    }).references(() => bottles.id),
    legacyCreationTarget:
      legacyStorePriceMatchCreationTargetEnum("creation_target"),
    // Classifier-asserted alias safety. A generic listing title is only safe to
    // reuse as a global bottle alias when the decision asserts `global_alias`;
    // null/"none" mean the exact listing may match but its title must not become
    // a reusable alias. Enforced at alias-write time in priceMatchingProposals.
    aliasScope: text("alias_scope").$type<"global_alias" | "none">(),
    candidateBottles: jsonb("candidate_bottles")
      .$type<Record<string, unknown>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    extractedLabel: jsonb("extracted_label").$type<Record<string, unknown>>(),
    proposedBottle: jsonb("proposed_bottle").$type<Record<string, unknown>>(),
    legacyProposedRelease:
      jsonb("proposed_release").$type<Record<string, unknown>>(),
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
      table.legacyCurrentReleaseId,
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
      table.legacySuggestedReleaseId,
    ),
    index("store_price_match_proposal_parent_bottle_idx").on(
      table.legacyParentBottleId,
    ),
    index("store_price_match_proposal_reviewed_by_idx").on(table.reviewedById),
  ],
);

export type StorePriceMatchProposal =
  typeof storePriceMatchProposals.$inferSelect;
export type NewStorePriceMatchProposal =
  typeof storePriceMatchProposals.$inferInsert;

export const storePriceMatchAttempts = pgTable(
  "store_price_match_attempt",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    priceId: bigint("price_id", { mode: "number" })
      .references(() => storePrices.id, { onDelete: "cascade" })
      .notNull(),
    proposalId: bigint("proposal_id", { mode: "number" })
      .references(() => storePriceMatchProposals.id, { onDelete: "cascade" })
      .notNull(),
    proposalType: storePriceMatchProposalTypeEnum("proposal_type").notNull(),
    initialStatus:
      storePriceMatchProposalStatusEnum("initial_status").notNull(),
    finalStatus: storePriceMatchProposalStatusEnum("final_status"),
    confidence: integer("confidence"),
    currentBottleId: bigint("current_bottle_id", { mode: "number" }).references(
      () => bottles.id,
      { onDelete: "set null" },
    ),
    // Retained compatibility columns for safe migrations; new logic uses Bottle IDs.
    legacyCurrentReleaseId: bigint("current_release_id", { mode: "number" }),
    suggestedBottleId: bigint("suggested_bottle_id", {
      mode: "number",
    }).references(() => bottles.id, { onDelete: "set null" }),
    legacySuggestedReleaseId: bigint("suggested_release_id", {
      mode: "number",
    }),
    legacyParentBottleId: bigint("parent_bottle_id", {
      mode: "number",
    }).references(() => bottles.id, { onDelete: "set null" }),
    legacyCreationTarget:
      legacyStorePriceMatchCreationTargetEnum("creation_target"),
    automationEligible: boolean("automation_eligible").default(false).notNull(),
    automationScore: integer("automation_score"),
    model: text("model"),
    error: text("error"),
    reviewedById: bigint("reviewed_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("store_price_match_attempt_price_idx").on(table.priceId),
    index("store_price_match_attempt_proposal_idx").on(table.proposalId),
    index("store_price_match_attempt_created_idx").on(table.createdAt),
    index("store_price_match_attempt_final_status_idx").on(table.finalStatus),
  ],
);

export const storePriceMatchAttemptsRelations = relations(
  storePriceMatchAttempts,
  ({ one }) => ({
    price: one(storePrices, {
      fields: [storePriceMatchAttempts.priceId],
      references: [storePrices.id],
    }),
    proposal: one(storePriceMatchProposals, {
      fields: [storePriceMatchAttempts.proposalId],
      references: [storePriceMatchProposals.id],
    }),
    reviewedBy: one(users, {
      fields: [storePriceMatchAttempts.reviewedById],
      references: [users.id],
    }),
    currentBottle: one(bottles, {
      fields: [storePriceMatchAttempts.currentBottleId],
      references: [bottles.id],
      relationName: "store_price_match_attempt_current_bottle",
    }),
    suggestedBottle: one(bottles, {
      fields: [storePriceMatchAttempts.suggestedBottleId],
      references: [bottles.id],
      relationName: "store_price_match_attempt_suggested_bottle",
    }),
  }),
);

export type StorePriceMatchAttempt =
  typeof storePriceMatchAttempts.$inferSelect;
export type NewStorePriceMatchAttempt =
  typeof storePriceMatchAttempts.$inferInsert;

export const storePriceMatchProposalsRelations = relations(
  storePriceMatchProposals,
  ({ many, one }) => ({
    price: one(storePrices, {
      fields: [storePriceMatchProposals.priceId],
      references: [storePrices.id],
    }),
    currentBottle: one(bottles, {
      fields: [storePriceMatchProposals.currentBottleId],
      references: [bottles.id],
    }),
    suggestedBottle: one(bottles, {
      fields: [storePriceMatchProposals.suggestedBottleId],
      references: [bottles.id],
    }),
    reviewedBy: one(users, {
      fields: [storePriceMatchProposals.reviewedById],
      references: [users.id],
    }),
    attempts: many(storePriceMatchAttempts),
  }),
);

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
