import { ENTITY_KIND_LIST } from "@peated/server/constants";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { bottles, bottlesToDistillers, countries } from ".";
import { tsvector } from "../columns";
import { geometry_point } from "../columns/geometry";
import { actors } from "./actors";
import { entityEvents } from "./entityEvents";
import { contentSourceEnum } from "./enums";
import { regions } from "./regions";

export type EntityKind = (typeof ENTITY_KIND_LIST)[number];

export const legacyEntityTypeEnum = pgEnum("entity_type", [
  "brand",
  "distiller",
  "bottler",
]);

export const entityKindEnum = pgEnum("entity_kind", ENTITY_KIND_LIST);

export const entities = pgTable(
  "entity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: text("name").notNull(),
    shortName: text("short_name"),

    ownerId: bigint("owner_id", { mode: "number" }),

    searchVector: tsvector("search_vector"),

    _country: text("country"),
    countryId: bigint("country_id", { mode: "number" }).references(
      () => countries.id,
    ),
    _region: text("region"),
    regionId: bigint("region_id", { mode: "number" }).references(
      () => regions.id,
    ),
    address: text("address"),
    location: geometry_point("location"),

    // Legacy storage only. Application code must not read or write this field.
    // Keep it available while it may support a future query optimization.
    type: legacyEntityTypeEnum("type")
      .array()
      .default(sql`ARRAY[]::entity_type[]`)
      .notNull(),
    // Every Entity has one top-level identity kind. Bottle links describe how
    // an Entity is used and must not change this value.
    kind: entityKindEnum("kind").notNull(),

    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    yearEstablished: smallint("year_established"),
    website: varchar("website", { length: 255 }),

    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdByActorId: bigint("created_by_actor_id", {
      mode: "number",
    })
      .references(() => actors.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("entity_name_unq").using("btree", sql`LOWER(${table.name})`),
    foreignKey({
      name: "entity_owner_fk",
      columns: [table.ownerId],
      foreignColumns: [table.id],
    })
      .onDelete("set null")
      .onUpdate("set null"),
    index("entity_kind_idx").on(table.kind),
    index("entity_owner_idx").on(table.ownerId),
    index("entity_search_idx").using("gin", table.searchVector),
    index("entity_country_by_idx").on(table.countryId),
    index("entity_region_idx").on(table.regionId),
    index("entity_created_by_actor_idx").on(table.createdByActorId),
  ],
);

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  distillersToBottles: many(bottlesToDistillers),
  brandsToBottles: many(bottles),
  owner: one(entities, {
    relationName: "entityOwner",
    fields: [entities.ownerId],
    references: [entities.id],
  }),
  ownedEntities: many(entities, { relationName: "entityOwner" }),
  country: one(countries, {
    fields: [entities.countryId],
    references: [countries.id],
  }),
  region: one(regions, {
    fields: [entities.regionId],
    references: [regions.id],
  }),
  createdByActor: one(actors, {
    fields: [entities.createdByActorId],
    references: [actors.id],
  }),
  events: many(entityEvents, { relationName: "entityEvents" }),
  acquisitionEvents: many(entityEvents, {
    relationName: "entityEventNewOwner",
  }),
}));

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export const entityAliases = pgTable(
  "entity_alias",
  {
    entityId: bigint("entity_id", { mode: "number" }).references(
      () => entities.id,
    ),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("entity_alias_entity_idx").on(table.entityId),
    uniqueIndex("entity_alias_name_idx").using(
      "btree",
      sql`LOWER(${table.name})`,
    ),
  ],
);

export const entityAliasesRelations = relations(entityAliases, ({ one }) => ({
  entity: one(entities, {
    fields: [entityAliases.entityId],
    references: [entities.id],
  }),
}));

export type EntityAlias = typeof entityAliases.$inferSelect;
export type NewEntityAlias = typeof entityAliases.$inferInsert;

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
