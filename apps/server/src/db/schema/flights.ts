import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { bottleReleases, bottles, catalogTargets } from "./bottles";
import { users } from "./users";

export const flights = pgTable(
  "flight",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("public_id", { length: 12 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    public: boolean("public").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (table) => [uniqueIndex("flight_public_id").on(table.publicId)],
);

export const flightsRelations = relations(flights, ({ one, many }) => ({
  flightBottles: many(flightBottles),
  createdBy: one(users, {
    fields: [flights.createdById],
    references: [users.id],
  }),
}));

export type Flight = typeof flights.$inferSelect;
export type NewFlight = typeof flights.$inferInsert;

/**
 * Target identity is authoritative. The nullable Bottle/Release pair remains
 * compatibility storage until task 9.6 removes it.
 */
export const flightBottles = pgTable(
  "flight_bottle",
  {
    flightId: bigint("flight_id", { mode: "number" })
      .references(() => flights.id)
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
  },
  (table) => [
    check(
      "flight_bottle_identity_check",
      sql`${table.bottleId} IS NOT NULL OR (${table.targetId} IS NOT NULL AND ${table.releaseId} IS NULL)`,
    ),
    uniqueIndex("flight_bottle_legacy_unq")
      .using(
        "btree",
        table.flightId,
        table.bottleId,
        sql`COALESCE(${table.releaseId}, 0)`,
      )
      .where(sql`${table.bottleId} IS NOT NULL`),
    uniqueIndex("flight_bottle_target_unq")
      .on(table.flightId, table.targetId)
      .where(sql`${table.targetId} IS NOT NULL`),
    index("flight_bottle_target_idx").on(table.targetId),
  ],
);

export const flightBottlesRelations = relations(flightBottles, ({ one }) => ({
  flight: one(flights, {
    fields: [flightBottles.flightId],
    references: [flights.id],
  }),
  bottle: one(bottles, {
    fields: [flightBottles.bottleId],
    references: [bottles.id],
  }),
  release: one(bottleReleases, {
    fields: [flightBottles.releaseId],
    references: [bottleReleases.id],
  }),
  target: one(catalogTargets, {
    fields: [flightBottles.targetId],
    references: [catalogTargets.id],
  }),
}));

export type FlightBottle = typeof flightBottles.$inferSelect;
export type NewFlightBottle = typeof flightBottles.$inferInsert;
