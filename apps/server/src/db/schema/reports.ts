import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const REPORT_OBJECT_TYPES = [
  "tasting",
  "member_review",
  "comment",
  "user",
] as const;

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual_content",
  "violence",
  "other",
] as const;

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;

export const reportObjectTypeEnum = pgEnum(
  "report_object_type",
  REPORT_OBJECT_TYPES,
);
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASONS);
export const reportStatusEnum = pgEnum("report_status", REPORT_STATUSES);

// A member's report of content or of another member. Moderators close a
// report after acting on it or dismissing it. Reports never store the
// reported content; the reported member is kept so a closed report still
// says who it was about after the content is gone.
export const reports = pgTable(
  "report",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    objectType: reportObjectTypeEnum("object_type").notNull(),
    objectId: bigint("object_id", { mode: "number" }).notNull(),
    reportedUserId: bigint("reported_user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    reason: reportReasonEnum("reason").notNull(),
    comment: text("comment"),
    status: reportStatusEnum("status").default("open").notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedById: bigint("closed_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    closedAt: timestamp("closed_at"),
    closeNote: text("close_note"),
  },
  (table) => [
    // One open report per member and target. Repeat reports return the
    // existing open report instead of a new row.
    uniqueIndex("report_open_unq")
      .on(table.createdById, table.objectType, table.objectId)
      .where(sql`${table.status} = 'open'`),
    index("report_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("report_object_idx").on(table.objectType, table.objectId),
    index("report_reported_user_idx").on(table.reportedUserId),
    check(
      "report_close_state_check",
      sql`(
        ${table.status} = 'open'
        AND ${table.closedAt} IS NULL
      ) OR (
        ${table.status} <> 'open'
        AND ${table.closedAt} IS NOT NULL
      )`,
    ),
  ],
);

export const reportsRelations = relations(reports, ({ one }) => ({
  createdBy: one(users, {
    fields: [reports.createdById],
    references: [users.id],
    relationName: "report_created_by",
  }),
  reportedUser: one(users, {
    fields: [reports.reportedUserId],
    references: [users.id],
    relationName: "report_reported_user",
  }),
  closedBy: one(users, {
    fields: [reports.closedById],
    references: [users.id],
    relationName: "report_closed_by",
  }),
}));

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ReportObjectType = (typeof REPORT_OBJECT_TYPES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
