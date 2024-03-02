import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { geography } from "../columns";

import { bottles, bottlesToDistillers } from ".";
import { users } from "./users";

export type EntityType = "brand" | "distiller" | "bottler";

export const entityTypeEnum = pgEnum("entity_type", [
  "brand",
  "distiller",
  "bottler",
]);

export const entities = pgTable(
  "entity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: text("name").notNull(),
    shortName: text("short_name"),
    country: text("country"),
    region: text("region"),
    type: entityTypeEnum("type").array().notNull(),

    description: text("description"),
    yearEstablished: smallint("year_established"),
    website: varchar("website", { length: 255 }),

    location: geography("location"),

    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (entities) => {
    return {
      nameIndex: uniqueIndex("entity_name_unq")
        .on(entities.name)
        .using(sql`btree (LOWER(full_name))`),
    };
  },
);

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  distillersToBottles: many(bottlesToDistillers),
  brandsToBottles: many(bottles),
  createdBy: one(users, {
    fields: [entities.createdById],
    references: [users.id],
  }),
}));

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export const entityTombstones = pgTable("entity_tombstone", {
  entityId: bigint("entity_id", { mode: "number" }).primaryKey(),
  newEntityId: bigint("new_entity_id", { mode: "number" }),
});

export const entityTombstonesRelations = relations(
  entityTombstones,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityTombstones.entityId],
      references: [entities.id],
    }),
    newEntity: one(entities, {
      fields: [entityTombstones.newEntityId],
      references: [entities.id],
    }),
  }),
);

export type EntityTombstone = typeof entityTombstones.$inferSelect;
export type NewEntityTombstone = typeof entityTombstones.$inferInsert;
