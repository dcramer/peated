import type { BottleExtractedDetails } from "@peated/bottle-classifier/contract";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottleChecks } from "./bottleChecks";
import { bottleReferences, bottles } from "./bottles";
import { externalSiteRuns, externalSites } from "./externalSites";
import { users } from "./users";

export const auctionLotStateEnum = pgEnum("auction_lot_state", [
  "upcoming",
  "live",
  "aftersale",
  "closed",
  "withdrawn",
  "unknown",
]);
export const auctionOutcomeEnum = pgEnum("auction_outcome", [
  "sold",
  "unsold",
  "cancelled",
  "unknown",
]);
export const auctionMatchStatusEnum = pgEnum("auction_match_status", [
  "pending",
  "matched",
  "review",
  "ignored",
]);
export const auctionPriceKindEnum = pgEnum("auction_price_kind", [
  "hammer",
  "aftersale",
]);

export const auctions = pgTable(
  "auction",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id)
      .notNull(),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("auction_site_source_unq").on(
      table.externalSiteId,
      table.sourceKey,
    ),
  ],
);

export const auctionLots = pgTable(
  "auction_lot",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    auctionId: bigint("auction_id", { mode: "number" })
      .references(() => auctions.id)
      .notNull(),
    sourceKey: text("source_key").notNull(),
    lotNumber: text("lot_number"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    volume: integer("volume"),
    condition: text("condition"),
    sourceBottleIdentity: jsonb(
      "source_bottle_identity",
    ).$type<BottleExtractedDetails>(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    sourceDetailsRequestedAt: timestamp("source_details_requested_at", {
      withTimezone: true,
    }),
    sourceDetailsCheckedAt: timestamp("source_details_checked_at", {
      withTimezone: true,
    }),
    sourceDetailsRunId: bigint("source_details_run_id", {
      mode: "number",
    }).references(() => externalSiteRuns.id),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    matchStatus: auctionMatchStatusEnum("match_status")
      .default("pending")
      .notNull(),
    matchCheckId: bigint("match_check_id", { mode: "number" }).references(
      () => bottleChecks.id,
    ),
    matchedReferenceId: bigint("matched_reference_id", {
      mode: "number",
    }).references(() => bottleReferences.id),
    matchedById: bigint("matched_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    availableSince: timestamp("available_since", { withTimezone: true }),
    state: auctionLotStateEnum("state").default("unknown").notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    currentBid: bigint("current_bid", { mode: "number" }),
    bidCurrency: text("bid_currency"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("auction_lot_occurrence_unq").on(
      table.auctionId,
      table.sourceKey,
    ),
    index("auction_lot_bottle_idx").on(table.bottleId),
    index("auction_lot_state_end_idx").on(table.state, table.endsAt),
    check(
      "auction_lot_volume_check",
      sql`${table.volume} IS NULL OR ${table.volume} > 0`,
    ),
    check(
      "auction_lot_bid_check",
      sql`(${table.currentBid} IS NULL AND ${table.bidCurrency} IS NULL) OR (${table.currentBid} IS NOT NULL AND ${table.bidCurrency} IS NOT NULL AND ${table.currentBid} BETWEEN 1 AND 9007199254740991 AND ${table.bidCurrency} IN ('gbp','usd','eur'))`,
    ),
    check(
      "auction_lot_match_check",
      sql`(${table.bottleId} IS NOT NULL) = (${table.matchStatus} = 'matched')`,
    ),
  ],
);

export const auctionLotResults = pgTable(
  "auction_lot_result",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    lotId: bigint("lot_id", { mode: "number" })
      .references(() => auctionLots.id)
      .notNull(),
    outcome: auctionOutcomeEnum("outcome").notNull(),
    amount: bigint("amount", { mode: "number" }),
    currency: text("currency"),
    priceKind: auctionPriceKindEnum("price_kind"),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    priceNote: text("price_note"),
    sourceUrl: text("source_url").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("auction_lot_result_latest_idx").on(table.lotId, table.id),
    uniqueIndex("auction_lot_result_observation_unq").on(
      table.lotId,
      table.observedAt,
    ),
    check(
      "auction_lot_result_price_check",
      sql`(${table.amount} IS NULL AND ${table.currency} IS NULL AND ${table.priceKind} IS NULL) OR (${table.outcome} = 'sold' AND ${table.amount} IS NOT NULL AND ${table.currency} IS NOT NULL AND ${table.amount} BETWEEN 1 AND 9007199254740991 AND ${table.currency} IN ('gbp','usd','eur') AND ${table.priceKind} IS NOT NULL)`,
    ),
    check(
      "auction_lot_result_time_check",
      sql`${table.soldAt} IS NULL OR ${table.outcome} = 'sold'`,
    ),
  ],
);

export const auctionWatches = pgTable(
  "auction_watch",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("auction_watch_user_bottle_unq").on(
      table.userId,
      table.bottleId,
    ),
    index("auction_watch_bottle_idx").on(table.bottleId),
  ],
);

// Auction alerts own duplicate prevention independently of deletable notifications.
export const auctionAlerts = pgTable(
  "auction_alert",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lotId: bigint("lot_id", { mode: "number" })
      .references(() => auctionLots.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("auction_alert_user_lot_unq").on(table.userId, table.lotId),
  ],
);

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  externalSite: one(externalSites, {
    fields: [auctions.externalSiteId],
    references: [externalSites.id],
  }),
  lots: many(auctionLots),
}));
export const auctionLotsRelations = relations(auctionLots, ({ one, many }) => ({
  auction: one(auctions, {
    fields: [auctionLots.auctionId],
    references: [auctions.id],
  }),
  bottle: one(bottles, {
    fields: [auctionLots.bottleId],
    references: [bottles.id],
  }),
  results: many(auctionLotResults),
}));
export const auctionLotResultsRelations = relations(
  auctionLotResults,
  ({ one }) => ({
    lot: one(auctionLots, {
      fields: [auctionLotResults.lotId],
      references: [auctionLots.id],
    }),
  }),
);
export type AuctionLot = typeof auctionLots.$inferSelect;
