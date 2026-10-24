import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { actors } from "./actors";
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

// Notes a moderator keeps for an Entity's About page. Every writer run reads
// them; they guide the writer but are never cited on the page.
export const entityAboutNotes = pgTable(
  "entity_about_note",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityId: bigint("entity_id", { mode: "number" })
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    text: varchar("text", { length: 500 }).notNull(),
    sourceUrl: text("source_url"),
    createdByActorId: bigint("created_by_actor_id", { mode: "number" })
      .references(() => actors.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("entity_about_note_entity_idx").on(table.entityId)],
);

export type EntityAboutNote = typeof entityAboutNotes.$inferSelect;
