import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottles } from "./bottles";
import { externalSites } from "./externalSites";

export const currencyEnum = pgEnum("currency", ["usd", "gbp", "eur"]);

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
  (table) => {
    return {
      nameUnique: uniqueIndex("store_price_unq_name").using(
        "btree",
        table.externalSiteId,
        sql`LOWER(${table.name})`,
        table.volume,
      ),
      bottleIdx: index("store_price_bottle_idx").on(table.bottleId),
    };
  },
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
  (storePriceHistories) => {
    return {
      priceDate: uniqueIndex("store_price_history_unq").on(
        storePriceHistories.priceId,
        storePriceHistories.volume,
        storePriceHistories.date,
      ),
    };
  },
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
