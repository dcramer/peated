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

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      email: uniqueIndex("user_email_unq").using(
        "btree",
        sql`LOWER(${table.email})`,
      ),
      username: uniqueIndex("user_username_unq").using(
        "btree",
        sql`LOWER(${table.username})`,
      ),
    };
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
