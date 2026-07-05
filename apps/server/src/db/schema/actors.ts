import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const actorTypeEnum = pgEnum("actor_type", ["system", "user"]);

export const actors = pgTable(
  "actor",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: actorTypeEnum("type").notNull(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    pictureUrl: text("picture_url"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("actor_type_key_unq").on(table.type, table.key),
    index("actor_user_idx").on(table.userId),
  ],
);

export const actorsRelations = relations(actors, ({ one }) => ({
  user: one(users, {
    fields: [actors.userId],
    references: [users.id],
  }),
}));

export type Actor = typeof actors.$inferSelect;
export type NewActor = typeof actors.$inferInsert;
