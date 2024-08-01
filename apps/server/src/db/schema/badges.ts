import type { BadgeCheck } from "@peated/server/types";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { BADGE_TYPE_LIST } from "../../constants";
import { users } from "./users";

export const badgeTypeEnum = pgEnum("badge_type", BADGE_TYPE_LIST);

export const badges = pgTable(
  "badges",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    imageUrl: text("image_url"),
    maxLevel: integer("max_level").default(50).notNull(),
    // TODO: config can be mapped to all badge type configs
    checks: jsonb("checks").$type<BadgeCheck[]>().default([]).notNull(),
  },
  (table) => {
    return {
      name: uniqueIndex("badge_name_unq").using(
        "btree",
        sql`LOWER(${table.name})`,
      ),
    };
  },
);

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;

export const badgeAwards = pgTable(
  "badge_award",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    badgeId: bigint("badge_id", { mode: "number" })
      .references(() => badges.id)
      .notNull(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    xp: smallint("xp").default(0).notNull(),
    level: smallint("level").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      constraint: uniqueIndex("badge_award_unq").on(
        table.badgeId,
        table.userId,
      ),
    };
  },
);

export const badgeAwardsRelations = relations(badgeAwards, ({ one }) => ({
  badge: one(badges, {
    fields: [badgeAwards.badgeId],
    references: [badges.id],
  }),
  user: one(users, {
    fields: [badgeAwards.userId],
    references: [users.id],
  }),
}));

export type BadgeAward = typeof badgeAwards.$inferSelect;
export type NewBadgeAward = typeof badgeAwards.$inferInsert;

export const badgeAwardTrackedObjectType = pgEnum("badge_award_object_type", [
  "bottle",
  "entity",
]);

export const badgeAwardTrackedObjects = pgTable(
  "badge_award_tracked_object",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    awardId: bigint("award_id", { mode: "number" })
      .references(() => badgeAwards.id)
      .notNull(),

    objectType: badgeAwardTrackedObjectType("object_type").notNull(),
    objectId: bigint("object_id", { mode: "number" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      constraint: uniqueIndex("badge_award_tracked_object_unq").on(
        table.awardId,
        table.objectType,
        table.objectId,
      ),
    };
  },
);

export const badgeAwardTrackedObjectsRelations = relations(
  badgeAwardTrackedObjects,
  ({ one }) => ({
    award: one(badgeAwards, {
      fields: [badgeAwardTrackedObjects.awardId],
      references: [badgeAwards.id],
    }),
  }),
);

export type BadgeAwardTrackedObject = typeof badgeAwards.$inferSelect;
export type NewBadgeAwardTrackedObject = typeof badgeAwards.$inferInsert;
