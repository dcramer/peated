import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { tastings } from "./tastings";
import { users } from "./users";

// Maximum length for comment text
const MAX_COMMENT_LENGTH = 2000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const comments = pgTable(
  "comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tastingId: bigint("tasting_id", { mode: "number" })
      .references(() => tastings.id)
      .notNull(),
    comment: varchar("comment", { length: MAX_COMMENT_LENGTH }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    // Add parentId for replies with ON DELETE CASCADE
    parentId: bigint("parent_id", { mode: "number" }).references(
      () => comments.id,
      { onDelete: "cascade" },
    ),
    // Add mentions field to store mentioned usernames with a length constraint
    mentions: varchar("mentions", { length: 500 }),
  },
  (table) => [
    uniqueIndex("comment_unq").on(
      table.tastingId,
      table.createdById,
      table.createdAt,
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const commentsRelations = relations(comments, ({ one, many }) => ({
  tasting: one(tastings, {
    fields: [comments.tastingId],
    references: [tastings.id],
  }),
  createdBy: one(users, {
    fields: [comments.createdById],
    references: [users.id],
  }),
  // Add parent relation
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
  // Add replies relation
  replies: many(comments, {
    relationName: "replies",
  }),
}));

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
