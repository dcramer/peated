import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
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
    name: varchar("name", { length: 255 }),
    type: badgeTypeEnum("type").notNull(),
    config: jsonb("config").$type<Record<string, any>>().default({}).notNull(),
  },
  (badges) => {
    return {
      name: uniqueIndex("badge_name_unq").on(badges.name),
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
    xp: smallint("points").default(0),
    level: smallint("level").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (badgeAwards) => {
    return {
      constraint: uniqueIndex("badge_award_unq").on(
        badgeAwards.badgeId,
        badgeAwards.userId,
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
