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
    displayName: text("display_name"),
    pictureUrl: text("picture_url"),

    private: boolean("private").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    admin: boolean("admin").default(false).notNull(),
    mod: boolean("mod").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (users) => {
    return {
      emailIndex: uniqueIndex("user_email_unq").on(users.email),
      usernameIndex: uniqueIndex("user_username_unq").on(users.username),
    };
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
