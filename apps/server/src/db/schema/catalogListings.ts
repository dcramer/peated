import type { BottleExtractedDetails } from "@peated/bottle-classifier/contract";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { externalSites } from "./externalSites";

export const catalogListings = pgTable(
  "catalog_listing",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    externalProductId: text("external_product_id"),
    sourceFingerprint: text("source_fingerprint").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    volume: integer("volume"),
    sourceBottleIdentity: jsonb(
      "source_bottle_identity",
    ).$type<BottleExtractedDetails>(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("catalog_listing_site_external_product_unq")
      .on(table.externalSiteId, table.externalProductId)
      .where(sql`${table.externalProductId} IS NOT NULL`),
    uniqueIndex("catalog_listing_site_url_unq").on(
      table.externalSiteId,
      table.url,
    ),
    index("catalog_listing_site_last_seen_idx").on(
      table.externalSiteId,
      table.lastSeenAt,
    ),
    check(
      "catalog_listing_volume_check",
      sql`${table.volume} IS NULL OR ${table.volume} > 0`,
    ),
  ],
);

export const catalogListingsRelations = relations(
  catalogListings,
  ({ one }) => ({
    externalSite: one(externalSites, {
      fields: [catalogListings.externalSiteId],
      references: [externalSites.id],
    }),
  }),
);

export type CatalogListing = typeof catalogListings.$inferSelect;
export type NewCatalogListing = typeof catalogListings.$inferInsert;
