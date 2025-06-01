import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { bottleReleases, bottles } from "./bottles";
import { users } from "./users";

export const collections = pgTable(
  "collection",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("collection_name_unq").using(
      "btree",
      sql`LOWER(${table.name}), ${table.createdById}`
    ),
    index("collection_created_by_idx").on(table.createdById),
  ]
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  collectionBottles: many(collectionBottles),
  createdBy: one(users, {
    fields: [collections.createdById],
    references: [users.id],
  }),
}));

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

export const collectionBottles = pgTable(
  "collection_bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    collectionId: bigint("collection_id", { mode: "number" })
      .references(() => collections.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique()
      .on(table.collectionId, table.bottleId, table.releaseId)
      .nullsNotDistinct(),
    index("collection_bottle_bottle_idx").on(table.bottleId),
    index("collection_bottle_release_idx").on(table.releaseId),
  ]
);

export const collectionBottlesRelations = relations(
  collectionBottles,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionBottles.collectionId],
      references: [collections.id],
    }),
    bottle: one(bottles, {
      fields: [collectionBottles.bottleId],
      references: [bottles.id],
    }),
  })
);

export type CollectionBottle = typeof collectionBottles.$inferSelect;
export type NewCollectionBottle = typeof collectionBottles.$inferInsert;
