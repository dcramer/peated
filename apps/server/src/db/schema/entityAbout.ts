import { relations } from "drizzle-orm";
import {
  bigint,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";

import { entities } from "./entities";

export const entityAboutStatusEnum = pgEnum("entity_about_status", [
  "published",
  "hidden",
]);

// One About document per Entity. The document's shape is owned by
// `EntityAboutDocumentSchema`; read and write it only through
// `lib/entityAbout/store.ts`, which checks it at both ends.
export const entityAbout = pgTable("entity_about", {
  entityId: bigint("entity_id", { mode: "number" })
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  document: jsonb("document").notNull(),
  schemaVersion: smallint("schema_version").notNull(),
  version: integer("version").notNull(),
  status: entityAboutStatusEnum("status").default("published").notNull(),
  checkedOn: date("checked_on", { mode: "string" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const entityAboutRelations = relations(entityAbout, ({ one }) => ({
  entity: one(entities, {
    fields: [entityAbout.entityId],
    references: [entities.id],
  }),
}));

export type EntityAboutRecord = typeof entityAbout.$inferSelect;
