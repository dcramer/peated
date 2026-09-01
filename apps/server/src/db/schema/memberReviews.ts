import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { bottles } from "./bottles";
import { servingStyleEnum } from "./tastings";
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
    tags: varchar("tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    color: integer("color"),
    notes: text("notes"),
    servingStyle: servingStyleEnum("serving_style"),
    friends: bigint("friends", { mode: "number" })
      .array()
      .default(sql`array[]::bigint[]`)
      .notNull(),
    imageUrl: text("image_url"),
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
