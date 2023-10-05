import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { bottles } from "./bottles";
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
  (flights) => {
    return {
      entityPublicId: uniqueIndex("flight_public_id").on(flights.publicId),
    };
  },
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

export const flightBottles = pgTable(
  "flight_bottle",
  {
    flightId: bigint("flight_id", { mode: "number" })
      .references(() => flights.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
  },
  (flightBottles) => {
    return {
      flightBottleId: primaryKey(
        flightBottles.flightId,
        flightBottles.bottleId,
      ),
    };
  },
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
}));

export type FlightBottle = typeof flightBottles.$inferSelect;
export type NewFlightBottle = typeof flightBottles.$inferInsert;
