import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { bottles } from "./bottles";
import { legacyReleaseRepairReviewResolutionEnum } from "./enums";

export const legacyReleaseRepairReviews = pgTable(
  "legacy_release_repair_review",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    legacyBottleId: bigint("legacy_bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),
    proposedParentFullName: varchar("proposed_parent_full_name", {
      length: 255,
    }).notNull(),
    releaseEdition: varchar("release_edition", { length: 255 }),
    releaseYear: integer("release_year"),
    resolution: legacyReleaseRepairReviewResolutionEnum("resolution").notNull(),
    reviewedParentBottleId: bigint("reviewed_parent_bottle_id", {
      mode: "number",
    }).references(() => bottles.id, { onDelete: "set null" }),
    blockedReason: text("blocked_reason"),
    reviewVersion: integer("review_version").default(1).notNull(),
    reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("legacy_release_repair_review_bottle_idx").on(
      table.legacyBottleId,
    ),
    index("legacy_release_repair_review_parent_idx").on(
      table.reviewedParentBottleId,
    ),
    index("legacy_release_repair_review_resolution_idx").on(table.resolution),
  ],
);

export const legacyReleaseRepairReviewsRelations = relations(
  legacyReleaseRepairReviews,
  ({ one }) => ({
    legacyBottle: one(bottles, {
      fields: [legacyReleaseRepairReviews.legacyBottleId],
      references: [bottles.id],
      relationName: "legacy_release_repair_review_legacy_bottle",
    }),
    reviewedParentBottle: one(bottles, {
      fields: [legacyReleaseRepairReviews.reviewedParentBottleId],
      references: [bottles.id],
      relationName: "legacy_release_repair_review_parent_bottle",
    }),
  }),
);

export type LegacyReleaseRepairReview =
  typeof legacyReleaseRepairReviews.$inferSelect;
export type NewLegacyReleaseRepairReview =
  typeof legacyReleaseRepairReviews.$inferInsert;
