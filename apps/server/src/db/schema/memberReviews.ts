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
import { actors } from "./actors";
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
    noseTags: varchar("nose_tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    palateTags: varchar("palate_tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    finishTags: varchar("finish_tags", { length: 64 })
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
    removedAt: timestamp("removed_at"),
    removedByActorId: bigint("removed_by_actor_id", {
      mode: "number",
    }).references(() => actors.id, { onDelete: "set null" }),
    removalReason: text("removal_reason"),
  },
  (table) => [
    uniqueIndex("member_review_bottle_member_unq").on(
      table.bottleId,
      table.createdById,
    ),
    index("member_review_created_by_idx").on(table.createdById),
    index("member_review_removed_updated_idx").on(
      table.removedAt,
      table.updatedAt,
      table.id,
    ),
    check("member_review_score_check", sql`${table.score} BETWEEN 0 AND 100`),
    check(
      "member_review_removal_state_check",
      sql`(
        ${table.removedAt} IS NULL
        AND ${table.removedByActorId} IS NULL
        AND ${table.removalReason} IS NULL
      ) OR (
        ${table.removedAt} IS NOT NULL
        AND ${table.removedByActorId} IS NOT NULL
        AND NULLIF(BTRIM(${table.removalReason}), '') IS NOT NULL
      )`,
    ),
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
  removedByActor: one(actors, {
    fields: [memberReviews.removedByActorId],
    references: [actors.id],
  }),
}));

export type MemberReview = typeof memberReviews.$inferSelect;
export type NewMemberReview = typeof memberReviews.$inferInsert;
