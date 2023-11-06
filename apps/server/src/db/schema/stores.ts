import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { STORE_TYPE_LIST } from "../../constants";
import { bottles } from "./bottles";
export const priceScraperTypeEnum = pgEnum(
  "price_scraper_type",
  STORE_TYPE_LIST,
);

export const stores = pgTable(
  "store",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: priceScraperTypeEnum("type").notNull(),
    name: text("name").notNull(),
    country: text("country"),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (stores) => {
    return {
      type: uniqueIndex("store_type").on(stores.type),
    };
  },
);

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export const storePrices = pgTable(
  "store_price",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    storeId: bigint("store_id", { mode: "number" })
      .references(() => stores.id)
      .notNull(),
    name: text("name").notNull(),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    price: integer("price").notNull(),
    volume: integer("volume").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (storePrices) => {
    return {
      storeName: uniqueIndex("store_price_unq_name").on(
        storePrices.storeId,
        storePrices.name,
        storePrices.volume,
      ),
    };
  },
);

export const storePricesRelations = relations(storePrices, ({ one }) => ({
  bottle: one(bottles, {
    fields: [storePrices.bottleId],
    references: [bottles.id],
  }),
  store: one(stores, {
    fields: [storePrices.storeId],
    references: [stores.id],
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
