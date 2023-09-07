import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { tastings } from "./tastings";
import { users } from "./users";

export const comments = pgTable(
  // oops named this wrong sorry
  "comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tastingId: bigint("tasting_id", { mode: "number" })
      .references(() => tastings.id)
      .notNull(),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (comments) => {
    return {
      comment: uniqueIndex("comment_unq").on(
        comments.tastingId,
        comments.createdById,
        comments.createdAt,
      ),
    };
  },
);

export const commentsRelations = relations(comments, ({ one }) => ({
  tasting: one(tastings, {
    fields: [comments.tastingId],
    references: [tastings.id],
  }),
  createdBy: one(users, {
    fields: [comments.createdById],
    references: [users.id],
  }),
}));

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
