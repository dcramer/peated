import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const followStatusEnum = pgEnum("follow_status", [
  "none",
  "pending",
  "following",
]);

export const follows = pgTable(
  "follow",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fromUserId: bigint("from_user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    toUserId: bigint("to_user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    status: followStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("follow_unq").on(table.fromUserId, table.toUserId),
    index("follow_to_user_idx").on(table.toUserId),
  ]
);

export const followsRelations = relations(follows, ({ one, many }) => ({
  fromUser: one(users, {
    fields: [follows.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [follows.toUserId],
    references: [users.id],
  }),
}));

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
