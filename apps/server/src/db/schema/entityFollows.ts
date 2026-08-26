import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core";

import { entities } from "./entities";
import { users } from "./users";

export const entityFollows = pgTable(
  "entity_follow",
  {
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    entityId: bigint("entity_id", { mode: "number" })
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entityId] }),
    index("entity_follow_entity_idx").on(table.entityId),
  ],
);

export const entityFollowsRelations = relations(entityFollows, ({ one }) => ({
  user: one(users, {
    fields: [entityFollows.userId],
    references: [users.id],
  }),
  entity: one(entities, {
    fields: [entityFollows.entityId],
    references: [entities.id],
  }),
}));

export type EntityFollow = typeof entityFollows.$inferSelect;
export type NewEntityFollow = typeof entityFollows.$inferInsert;
