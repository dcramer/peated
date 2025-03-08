import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { SERVING_STYLE_LIST } from "../../constants";
import { badgeAwards } from "./badges";
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
  (table) => [
    uniqueIndex("tasting_unq").on(
      table.bottleId,
      table.createdById,
      table.createdAt,
    ),
    index("tasting_bottle_idx").on(table.bottleId),
    index("tasting_flight_idx").on(table.flightId),
    index("tasting_created_by_idx").on(table.createdById),
  ],
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

export const tastingBadgeAwards = pgTable(
  "tasting_badge_award",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tastingId: bigint("tasting_id", { mode: "number" })
      .references(() => tastings.id)
      .notNull(),
    awardId: bigint("award_id", { mode: "number" })
      .references(() => badgeAwards.id)
      .notNull(),
    level: smallint("level").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tasting_badge_award_key").on(table.tastingId, table.awardId),
    index("tasting_badge_award_award_id").on(table.awardId),
  ],
);

export const tastingBadgeAwardsRelations = relations(
  tastingBadgeAwards,
  ({ one }) => ({
    award: one(badgeAwards, {
      fields: [tastingBadgeAwards.awardId],
      references: [badgeAwards.id],
    }),
  }),
);

export type TastingBadgeAward = typeof tastingBadgeAwards.$inferSelect;
export type NewTastingBadgeAward = typeof tastingBadgeAwards.$inferInsert;
