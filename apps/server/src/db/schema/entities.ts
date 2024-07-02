import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { bottles, bottlesToDistillers, countries } from ".";
import { tsvector } from "../columns";
import { geometry_point } from "../columns/geoemetry";
import { contentSourceEnum } from "./enums";
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

    searchVector: tsvector("search_vector"),

    _country: text("country"),
    countryId: bigint("country_id", { mode: "number" }).references(
      () => countries.id,
    ),
    region: text("region"),
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
  (table) => {
    return {
      nameIndex: uniqueIndex("entity_name_unq")
        .on(table.name)
        .using(sql`btree (LOWER(full_name))`),
      searchVectorIndex: index("entity_search_idx")
        .on(table.searchVector)
        .using(sql`gin(${table.searchVector})`),
      createdById: index("entity_created_by_idx").on(table.createdById),
    };
  },
);

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  distillersToBottles: many(bottlesToDistillers),
  brandsToBottles: many(bottles),
  country: one(countries, {
    fields: [entities.countryId],
    references: [countries.id],
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
  },
  (entityAliases) => {
    return {
      pk: primaryKey(entityAliases.name),
      entityIdx: index("entity_alias_entity_idx").on(entityAliases.entityId),
    };
  },
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
