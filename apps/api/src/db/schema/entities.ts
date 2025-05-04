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
import { contentSourceEnum } from "./enums";
import { regions } from "./regions";
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

    parentId: bigint("parent_id", { mode: "number" }),

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

    type: entityTypeEnum("type").array().notNull(),

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
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("entity_name_unq").using("btree", sql`LOWER(${table.name})`),
    foreignKey({
      name: "entity_parent_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }),
    index("entity_search_idx").using("gin", table.searchVector),
    index("entity_country_by_idx").on(table.countryId),
    index("entity_region_idx").on(table.regionId),
    index("entity_created_by_idx").on(table.createdById),
  ],
);

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  distillersToBottles: many(bottlesToDistillers),
  brandsToBottles: many(bottles),
  country: one(countries, {
    fields: [entities.countryId],
    references: [countries.id],
  }),
  region: one(regions, {
    fields: [entities.countryId],
    references: [regions.id],
  }),
  createdBy: one(users, {
    fields: [entities.createdById],
    references: [users.id],
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
