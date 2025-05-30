import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import {
  CASK_FILLS,
  CASK_SIZE_IDS,
  CASK_TYPE_IDS,
} from "@peated/server/constants";
import { tsvector } from "../columns";
import { vector } from "../columns/vector";
import { entities } from "./entities";
import { categoryEnum, contentSourceEnum, flavorProfileEnum } from "./enums";
import { users } from "./users";

type TastingNotes = {
  nose: string;
  palate: string;
  finish: string;
};

/**
 * Represents a series of bottles from a brand.
 * A series groups related bottles together and contains shared characteristics.
 * Examples: Macallan 18, Octomore 13, Ardbeg Supernova
 */
export const bottleSeries = pgTable(
  "bottle_series",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    brandId: bigint("brand_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
    description: text("description"),
    searchVector: tsvector("search_vector"),
    numReleases: bigint("num_releases", { mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("bottle_series_full_name_key").using(
      "btree",
      sql`LOWER(${table.fullName})`,
    ),
    index("bottle_series_search_idx").using("gin", table.searchVector),
    index("bottle_series_brand_idx").on(table.brandId),
    index("bottle_series_created_by_idx").on(table.createdById),
  ],
);

export type BottleSeries = typeof bottleSeries.$inferSelect;
export type NewBottleSeries = typeof bottleSeries.$inferInsert;

/**
 * Represents a unique expression from a brand.
 * This is the parent table that contains the core information about a bottle.
 * Each bottle can have multiple editions (vintages, releases, etc.) which are stored in bottle_edition.
 *
 * Some fields (description, imageUrl, etc.) are materialized from the editions,
 * meaning they represent an aggregate or selected value from the editions.
 *
 * Examples:
 * 1. Ardbeg Supernova
 *    - Brand: Ardbeg
 *    - Series: Supernova
 *    - Multiple editions released in 2009, 2010, 2014, 2015, 2019
 *
 * 2. Octomore
 *    - Brand: Octomore
 *    - Series: 13
 *    - Multiple editions like 13.1, 13.2, 13.3, etc.
 *
 * 3. Macallan 18
 *    - Brand: Macallan
 *    - Series: 18-year-old
 *    - Multiple editions by vintage year (1993, 1994, etc.)
 */
export const bottles = pgTable(
  "bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // canonical name including brand
    fullName: varchar("full_name", { length: 255 }).notNull(),
    // canonical name excluding brand
    name: varchar("name", { length: 255 }).notNull(),

    // statedAge is only present on the expression level if its always the same across any release
    // and when it is present, it will be included in the canonical expression name
    statedAge: smallint("stated_age"),

    // a NULL series represents a "core bottling"
    seriesId: bigint("series_id", { mode: "number" }).references(
      () => bottleSeries.id,
    ),

    searchVector: tsvector("search_vector"),

    category: categoryEnum("category"),
    brandId: bigint("brand_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
    bottlerId: bigint("bottler_id", { mode: "number" }).references(
      () => entities.id,
    ),
    flavorProfile: flavorProfileEnum("flavor_profile"),

    // @deprecated - being migrated to bottle_edition table
    edition: varchar("edition", { length: 255 }),
    // @deprecated - being migrated to bottle_edition table
    abv: doublePrecision("abv"),
    // @deprecated - being migrated to bottle_edition table
    singleCask: boolean("single_cask"),
    // @deprecated - being migrated to bottle_edition table
    caskStrength: boolean("cask_strength"),
    // @deprecated - being migrated to bottle_edition table
    vintageYear: smallint("vintage_year"),
    // @deprecated - being migrated to bottle_edition table
    releaseYear: smallint("release_year"),
    // @deprecated - being migrated to bottle_edition table
    caskSize: varchar("cask_size", { length: 255, enum: CASK_SIZE_IDS }),
    // @deprecated - being migrated to bottle_edition table
    caskType: varchar("cask_type", { length: 255, enum: CASK_TYPE_IDS }),
    // @deprecated - being migrated to bottle_edition table
    caskFill: varchar("cask_fill", { length: 255, enum: CASK_FILLS }),

    // Materialized fields from editions
    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    imageUrl: text("image_url"),
    tastingNotes: jsonb("tasting_notes").$type<TastingNotes>(),
    suggestedTags: varchar("suggested_tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    avgRating: doublePrecision("avg_rating"),
    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),
    numReleases: bigint("num_releases", { mode: "number" })
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    index("bottle_search_idx").using("gin", table.searchVector),
    index("bottle_brand_idx").on(table.brandId),
    index("bottle_bottler_idx").on(table.bottlerId),
    index("bottle_created_by_idx").on(table.createdById),
    index("bottle_category_idx").on(table.category),
    index("bottle_flavor_profile_idx").on(table.flavorProfile),
    check(
      "bottle_stated_age_check",
      sql`${table.statedAge} IS NULL OR (${table.statedAge} >= 0 AND ${table.statedAge} <= 100)`,
    ),
  ],
);

export type Bottle = typeof bottles.$inferSelect;
export type NewBottle = typeof bottles.$inferInsert;

export const bottlesRelations = relations(bottles, ({ one, many }) => ({
  brand: one(entities, {
    fields: [bottles.brandId],
    references: [entities.id],
  }),
  bottler: one(entities, {
    fields: [bottles.bottlerId],
    references: [entities.id],
  }),
  series: one(bottleSeries, {
    fields: [bottles.seriesId],
    references: [bottleSeries.id],
  }),
  bottlesToDistillers: many(bottlesToDistillers),
  releases: many(bottleReleases),
  createdBy: one(users, {
    fields: [bottles.createdById],
    references: [users.id],
  }),
}));

export const bottleSeriesRelations = relations(
  bottleSeries,
  ({ one, many }) => ({
    brand: one(entities, {
      fields: [bottleSeries.brandId],
      references: [entities.id],
    }),
    bottles: many(bottles, {
      relationName: "series",
    }),
    createdBy: one(users, {
      fields: [bottleSeries.createdById],
      references: [users.id],
    }),
  }),
);

/**
 * Represents a specific edition/release/vintage of a bottle.
 * This contains all the specific details about a particular release,
 * such as ABV, cask details, vintage year, etc.
 *
 * Each edition belongs to a parent bottle and inherits its core attributes,
 * while adding edition-specific details.
 *
 * Examples:
 * 1. Ardbeg Supernova 2019 Release
 *    - Bottle: Ardbeg Supernova
 *    - Release Year: 2019
 *    - ABV: 53.8%
 *    - Edition-specific details: ppm, cask types, etc.
 *
 * 2. Octomore 13.1
 *    - Bottle: Octomore
 *    - Expression: 13.1
 *    - Release Year: 2022
 *    - ABV: 59.2%
 *    - Edition-specific details: 137.3 ppm, 5 years old, ex-American oak
 *
 * 3. Macallan 18 Year Old 1993
 *    - Bottle: Macallan 18
 *    - Vintage Year: 1993
 *    - Release Year: 2011
 *    - ABV: 43%
 *    - Edition-specific details: Sherry oak casks
 */
export const bottleReleases = pgTable(
  "bottle_release",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),

    // canonical name, including brand
    fullName: varchar("full_name", { length: 255 }).notNull(),
    // canonical name, excluding brand
    name: varchar("name", { length: 255 }).notNull(),

    searchVector: tsvector("search_vector"),

    // Release-specific fields
    edition: varchar("edition", { length: 255 }),
    vintageYear: smallint("vintage_year"),
    releaseYear: smallint("release_year"),
    abv: doublePrecision("abv"),
    singleCask: boolean("single_cask"),
    caskStrength: boolean("cask_strength"),
    statedAge: smallint("stated_age"),

    // Cask details
    caskSize: varchar("cask_size", { length: 255, enum: CASK_SIZE_IDS }),
    caskType: varchar("cask_type", { length: 255, enum: CASK_TYPE_IDS }),
    caskFill: varchar("cask_fill", { length: 255, enum: CASK_FILLS }),

    // Release-specific content
    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    imageUrl: text("image_url"),
    tastingNotes: jsonb("tasting_notes").$type<TastingNotes>(),
    suggestedTags: varchar("suggested_tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),

    // Release-specific stats
    avgRating: doublePrecision("avg_rating"),
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
    index("bottle_release_bottle_idx").on(table.bottleId),
    index("bottle_release_created_by_idx").on(table.createdById),
    uniqueIndex("bottle_release_full_name_idx").on(table.fullName),
    check(
      "bottle_release_stated_age_check",
      sql`${table.statedAge} IS NULL OR (${table.statedAge} >= 0 AND ${table.statedAge} <= 100)`,
    ),
  ],
);

export const bottleReleasesRelations = relations(bottleReleases, ({ one }) => ({
  bottle: one(bottles, {
    fields: [bottleReleases.bottleId],
    references: [bottles.id],
  }),
  createdBy: one(users, {
    fields: [bottleReleases.createdById],
    references: [users.id],
  }),
}));

export type BottleRelease = typeof bottleReleases.$inferSelect;
export type NewBottleRelease = typeof bottleReleases.$inferInsert;

export const bottlesToDistillers = pgTable(
  "bottle_distiller",
  {
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    distillerId: bigint("distiller_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.bottleId, table.distillerId] })],
);

export const bottlesToDistillersRelations = relations(
  bottlesToDistillers,
  ({ one }) => ({
    bottle: one(bottles, {
      fields: [bottlesToDistillers.bottleId],
      references: [bottles.id],
    }),
    distiller: one(entities, {
      fields: [bottlesToDistillers.distillerId],
      references: [entities.id],
    }),
  }),
);

export type BottlesToDistillers = typeof bottlesToDistillers.$inferSelect;
export type NewBottlesToDistillers = typeof bottlesToDistillers.$inferInsert;

export const bottleTags = pgTable(
  "bottle_tag",
  {
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    tag: varchar("tag", { length: 64 }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.bottleId, table.tag] })],
);

export const bottleTagsRelations = relations(bottleTags, ({ one }) => ({
  bottle: one(bottles, {
    fields: [bottleTags.bottleId],
    references: [bottles.id],
  }),
}));

export type BottleTag = typeof bottleTags.$inferSelect;
export type NewBottleTag = typeof bottleTags.$inferInsert;

export const bottleAliases = pgTable(
  "bottle_alias",
  {
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id,
    ),
    name: varchar("name", { length: 255 }).notNull(),
    embedding: vector("embedding", { length: 3072 }),
    // ignored is used to hide this alias from matches
    ignored: boolean("ignored").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bottle_alias_name_idx").using(
      "btree",
      sql`LOWER(${table.name})`,
    ),
    index("bottle_alias_bottle_idx").on(table.bottleId),
    index("bottle_alias_release_idx").on(table.releaseId),
  ],
);

export const bottleAliasesRelations = relations(bottleAliases, ({ one }) => ({
  bottle: one(bottles, {
    fields: [bottleAliases.bottleId],
    references: [bottles.id],
  }),
  release: one(bottleReleases, {
    fields: [bottleAliases.releaseId],
    references: [bottleReleases.id],
  }),
}));

export type BottleAlias = typeof bottleAliases.$inferSelect;
export type NewBottleAlias = typeof bottleAliases.$inferInsert;

export const bottleTombstones = pgTable("bottle_tombstone", {
  bottleId: bigint("bottle_id", { mode: "number" }).primaryKey(),
  newBottleId: bigint("new_bottle_id", { mode: "number" }),
});

export const bottleTombstonesRelations = relations(
  bottleTombstones,
  ({ one }) => ({
    bottle: one(bottles, {
      fields: [bottleTombstones.bottleId],
      references: [bottles.id],
    }),
    newBottle: one(bottles, {
      fields: [bottleTombstones.newBottleId],
      references: [bottles.id],
    }),
  }),
);

export type BottleTombstone = typeof bottleTombstones.$inferSelect;
export type NewBottleTombstone = typeof bottleTombstones.$inferInsert;

export const bottleFlavorProfiles = pgTable(
  "bottle_flavor_profile",
  {
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    flavorProfile: flavorProfileEnum("flavor_profile").notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.bottleId, table.flavorProfile] })],
);

export const bottleFlavorProfilesRelations = relations(
  bottleFlavorProfiles,
  ({ one }) => ({
    bottle: one(bottles, {
      fields: [bottleFlavorProfiles.bottleId],
      references: [bottles.id],
    }),
  }),
);

export type BottleFlavorProfile = typeof bottleFlavorProfiles.$inferSelect;
export type NewBottleFlavorProfile = typeof bottleFlavorProfiles.$inferInsert;
