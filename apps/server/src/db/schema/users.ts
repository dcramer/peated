import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
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
  },
  (table) => [
    uniqueIndex("user_email_unq").using("btree", sql`LOWER(${table.email})`),
    uniqueIndex("user_username_unq").using(
      "btree",
      sql`LOWER(${table.username})`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
