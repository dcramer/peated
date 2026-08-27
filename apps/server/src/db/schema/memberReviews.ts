import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottles } from "./bottles";
import { users } from "./users";

export const memberReviews = pgTable(
  "member_review",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    score: smallint("score").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_review_bottle_member_unq").on(
      table.bottleId,
      table.createdById,
    ),
    index("member_review_bottle_idx").on(table.bottleId),
    index("member_review_created_by_idx").on(table.createdById),
    check("member_review_score_check", sql`${table.score} BETWEEN 0 AND 100`),
  ],
);

export const memberReviewsRelations = relations(memberReviews, ({ one }) => ({
  bottle: one(bottles, {
    fields: [memberReviews.bottleId],
    references: [bottles.id],
  }),
  createdBy: one(users, {
    fields: [memberReviews.createdById],
    references: [users.id],
  }),
}));

export type MemberReview = typeof memberReviews.$inferSelect;
export type NewMemberReview = typeof memberReviews.$inferInsert;
