import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "user",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: varchar("password_hash", { length: 256 }),
    pictureUrl: text("picture_url"),

    verified: boolean("verified").default(false).notNull(),
    private: boolean("private").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    admin: boolean("admin").default(false).notNull(),
    mod: boolean("mod").default(false).notNull(),

    notifyComments: boolean("notify_comments").default(true),

    termsAcceptedAt: timestamp("terms_accepted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Set when the member asks to delete their account. The deletion runs
    // after a grace period unless the member cancels; see
    // docs/architecture/account-access.md.
    deletionRequestedAt: timestamp("deletion_requested_at"),
    // Set when the account was deleted. The row stays as a tombstone with
    // personal fields replaced.
    deletedAt: timestamp("deleted_at"),
    // Set while a moderator has suspended the account. A suspended member can
    // only read their own account, delete it, or cancel a pending deletion;
    // see docs/architecture/account-access.md.
    suspendedAt: timestamp("suspended_at"),
    suspendedById: bigint("suspended_by_id", { mode: "number" }).references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    suspensionReason: text("suspension_reason"),
  },
  (table) => [
    uniqueIndex("user_email_unq").using("btree", sql`LOWER(${table.email})`),
    uniqueIndex("user_username_unq").using(
      "btree",
      sql`LOWER(${table.username})`,
    ),
    // Suspension rule (moderation): a suspension always carries a reason.
    check(
      "user_suspension_state_check",
      sql`(
        ${table.suspendedAt} IS NULL
        AND ${table.suspensionReason} IS NULL
      ) OR (
        ${table.suspendedAt} IS NOT NULL
        AND NULLIF(BTRIM(${table.suspensionReason}), '') IS NOT NULL
      )`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
