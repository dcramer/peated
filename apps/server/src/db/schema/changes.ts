import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { actors } from "./actors";
import { objectTypeEnum } from "./enums";

export const changeTypeEnum = pgEnum("type", ["add", "update", "delete"]);

export const changes = pgTable(
  "change",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    objectId: bigint("object_id", { mode: "number" }).notNull(),
    objectType: objectTypeEnum("object_type").notNull(),
    type: changeTypeEnum("type").default("add").notNull(),
    displayName: text("display_name"),
    data: jsonb("data").default({}).notNull().$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    actorId: bigint("actor_id", { mode: "number" })
      .references(() => actors.id)
      .notNull(),
  },
  (table) => [index("change_actor_idx").on(table.actorId)],
);

export const changesRelations = relations(changes, ({ one }) => ({
  actor: one(actors, {
    fields: [changes.actorId],
    references: [actors.id],
  }),
}));

export type Change = typeof changes.$inferSelect;
export type NewChange = typeof changes.$inferInsert;
