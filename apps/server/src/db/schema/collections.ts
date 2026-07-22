import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { bottleReleases, bottles, catalogTargets } from "./bottles";
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
      sql`LOWER(${table.name}), ${table.createdById}`,
    ),
    index("collection_created_by_idx").on(table.createdById),
  ],
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

export const collectionBottleStatusEnum = pgEnum("collection_bottle_status", [
  "sealed",
  "open",
  "empty",
]);

/**
 * Target identity is authoritative. The nullable Bottle/Release pair remains
 * compatibility storage until task 9.6 removes it.
 */
export const collectionBottles = pgTable(
  "collection_bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    collectionId: bigint("collection_id", { mode: "number" })
      .references(() => collections.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id,
    ),
    targetId: bigint("target_id", { mode: "number" }).references(
      () => catalogTargets.id,
    ),
    imageUrl: text("image_url"),
    status: collectionBottleStatusEnum("status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "collection_bottle_identity_check",
      sql`${table.bottleId} IS NOT NULL OR (${table.targetId} IS NOT NULL AND ${table.releaseId} IS NULL)`,
    ),
    uniqueIndex("collection_bottle_legacy_unq")
      .using(
        "btree",
        table.collectionId,
        table.bottleId,
        sql`COALESCE(${table.releaseId}, 0)`,
      )
      .where(sql`${table.bottleId} IS NOT NULL`),
    uniqueIndex("collection_bottle_target_unq")
      .on(table.collectionId, table.targetId)
      .where(sql`${table.targetId} IS NOT NULL`),
    index("collection_bottle_bottle_idx").on(table.bottleId),
    index("collection_bottle_release_idx").on(table.releaseId),
    index("collection_bottle_target_idx").on(table.targetId),
  ],
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
    target: one(catalogTargets, {
      fields: [collectionBottles.targetId],
      references: [catalogTargets.id],
    }),
  }),
);

export type CollectionBottle = typeof collectionBottles.$inferSelect;
export type NewCollectionBottle = typeof collectionBottles.$inferInsert;
