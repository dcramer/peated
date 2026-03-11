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
    suggestedBottleId: bigint("suggested_bottle_id", {
      mode: "number",
    }).references(() => bottles.id),
    candidateBottles: jsonb("candidate_bottles")
      .$type<Record<string, unknown>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    extractedLabel: jsonb("extracted_label").$type<Record<string, unknown>>(),
    proposedBottle: jsonb("proposed_bottle").$type<Record<string, unknown>>(),
    searchEvidence: jsonb("search_evidence")
      .$type<Record<string, unknown>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    rationale: text("rationale"),
    model: text("model"),
    error: text("error"),
    lastEvaluatedAt: timestamp("last_evaluated_at"),
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
    index("store_price_match_proposal_suggested_bottle_idx").on(
      table.suggestedBottleId,
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
    suggestedBottle: one(bottles, {
      fields: [storePriceMatchProposals.suggestedBottleId],
      references: [bottles.id],
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
