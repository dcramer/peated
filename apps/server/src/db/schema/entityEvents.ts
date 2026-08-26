import { ENTITY_EVENT_KIND_LIST } from "@peated/server/constants";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { actors } from "./actors";
import { entities } from "./entities";

export const entityEventKindEnum = pgEnum(
  "entity_event_kind",
  ENTITY_EVENT_KIND_LIST,
);

export const entityEvents = pgTable(
  "entity_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityId: bigint("entity_id", { mode: "number" })
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    kind: entityEventKindEnum("kind").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    description: text("description"),
    newOwnerId: bigint("new_owner_id", { mode: "number" }).references(
      () => entities.id,
    ),
    sourceUrl: text("source_url"),
    createdByActorId: bigint("created_by_actor_id", { mode: "number" })
      .references(() => actors.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("entity_event_entity_date_idx").on(table.entityId, table.date),
    index("entity_event_new_owner_idx").on(table.newOwnerId),
    index("entity_event_created_by_actor_idx").on(table.createdByActorId),
    check(
      "entity_event_date_check",
      sql`${table.date} ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'`,
    ),
    check(
      "entity_event_generic_description_check",
      sql`${table.kind} <> 'generic' OR NULLIF(BTRIM(${table.description}), '') IS NOT NULL`,
    ),
    check(
      "entity_event_owner_check",
      sql`(${table.kind} = 'acquired' AND ${table.newOwnerId} IS NOT NULL) OR (${table.kind} <> 'acquired' AND ${table.newOwnerId} IS NULL)`,
    ),
    check(
      "entity_event_owner_not_self_check",
      sql`${table.newOwnerId} IS NULL OR ${table.entityId} <> ${table.newOwnerId}`,
    ),
  ],
);

export const entityEventsRelations = relations(entityEvents, ({ one }) => ({
  entity: one(entities, {
    relationName: "entityEvents",
    fields: [entityEvents.entityId],
    references: [entities.id],
  }),
  newOwner: one(entities, {
    relationName: "entityEventNewOwner",
    fields: [entityEvents.newOwnerId],
    references: [entities.id],
  }),
  createdByActor: one(actors, {
    fields: [entityEvents.createdByActorId],
    references: [actors.id],
  }),
}));

export type EntityEvent = typeof entityEvents.$inferSelect;
export type NewEntityEvent = typeof entityEvents.$inferInsert;
