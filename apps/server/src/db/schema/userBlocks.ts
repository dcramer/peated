import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// A block stops two members from interacting: no comments, toasts, or friend
// requests in either direction. It does not hide content. See
// docs/features/reports-and-blocks.md.
export const userBlocks = pgTable(
  "user_block",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    blockedUserId: bigint("blocked_user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_block_unq").on(table.userId, table.blockedUserId),
    index("user_block_blocked_user_idx").on(table.blockedUserId),
  ],
);

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  user: one(users, {
    fields: [userBlocks.userId],
    references: [users.id],
  }),
  blockedUser: one(users, {
    fields: [userBlocks.blockedUserId],
    references: [users.id],
  }),
}));

export type UserBlock = typeof userBlocks.$inferSelect;
export type NewUserBlock = typeof userBlocks.$inferInsert;
