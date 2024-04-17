import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { SERVING_STYLE_LIST } from "../../constants";
import { bottles } from "./bottles";
import { flights } from "./flights";
import { users } from "./users";

export const servingStyleEnum = pgEnum("servingStyle", SERVING_STYLE_LIST);

export const tastings = pgTable(
  "tasting",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    tags: varchar("tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    color: integer("color"),
    rating: doublePrecision("rating"),
    imageUrl: text("image_url"),
    notes: text("notes"),
    servingStyle: servingStyleEnum("serving_style"),
    friends: bigint("friends", { mode: "number" })
      .array()
      .default(sql`array[]::bigint[]`)
      .notNull(),
    flightId: bigint("flight_id", { mode: "number" }).references(
      () => flights.id,
    ),

    comments: integer("comments").default(0).notNull(),
    toasts: integer("toasts").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (tastings) => {
    return {
      tasting: uniqueIndex("tasting_unq").on(
        tastings.bottleId,
        tastings.createdById,
        tastings.createdAt,
      ),
      bottleId: index("tasting_bottle_idx").on(tastings.bottleId),
      flightId: index("tasting_flight_idx").on(tastings.flightId),
      createdById: index("tasting_created_by_idx").on(tastings.createdById),
    };
  },
);

export const tastingsRelations = relations(tastings, ({ one }) => ({
  bottle: one(bottles, {
    fields: [tastings.bottleId],
    references: [bottles.id],
  }),
  createdBy: one(users, {
    fields: [tastings.createdById],
    references: [users.id],
  }),
}));

export type Tasting = typeof tastings.$inferSelect;
export type NewTasting = typeof tastings.$inferInsert;
