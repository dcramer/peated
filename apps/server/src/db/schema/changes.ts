import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { objectTypeEnum } from "./enums";
import { users } from "./users";

export const changeTypeEnum = pgEnum("type", ["add", "update", "delete"]);

export const changes = pgTable("change", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  objectId: bigint("object_id", { mode: "number" }).notNull(),
  objectType: objectTypeEnum("object_type").notNull(),
  type: changeTypeEnum("type").default("add").notNull(),
  displayName: text("display_name"),
  data: jsonb("data").default({}).notNull().$type<Record<string, any>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: bigint("created_by_id", { mode: "number" })
    .references(() => users.id)
    .notNull(),
});

export const changesRelations = relations(changes, ({ one }) => ({
  createdBy: one(users, {
    fields: [changes.createdById],
    references: [users.id],
  }),
}));

export type Change = typeof changes.$inferSelect;
export type NewChange = typeof changes.$inferInsert;
