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
import { externalSites } from "./externalSites";
import { users } from "./users";

type TastingNotes = {
  nose: string;
  palate: string;
  finish: string;
};

const OBSERVATION_SOURCE_TYPES = ["store_price"] as const;

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
 * Represents the stable parent product from a brand.
 * This is the default identity object that most users taste, search, and collect.
 * Child releases are optional and only used when a reusable marketed distinction
 * should aggregate separately across users, prices, and stats.
 *
 * A bottle may temporarily carry release-like traits when only one marketed
 * form is known, or when older data predates an explicit release split.
 *
 * Some fields (description, imageUrl, etc.) are materialized from child
 * releases when they exist.
 *
 * Examples:
 * 1. Ardbeg Supernova
 *    - Brand: Ardbeg
 *    - Series: Supernova
 *    - Can have child releases such as 2019 Release or later annual releases
 *
 * 2. Macallan 18
 *    - Brand: Macallan
 *    - Series: 18-year-old
 *    - Can have child releases by vintage year (1993, 1994, etc.)
 *
 * 3. Octomore 13.1
 *    - One bottle
 *    - `13.1` is part of the bottle identity, not a child release
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

    // Legacy or single-known-release traits can remain on bottle. Once a
    // reusable child release boundary is clear, new canonical release data
    // should prefer bottle_release.
    edition: varchar("edition", { length: 255 }),
    abv: doublePrecision("abv"),
    singleCask: boolean("single_cask"),
    caskStrength: boolean("cask_strength"),
    vintageYear: smallint("vintage_year"),
    releaseYear: smallint("release_year"),
    caskSize: varchar("cask_size", { length: 255, enum: CASK_SIZE_IDS }),
    caskType: varchar("cask_type", { length: 255, enum: CASK_TYPE_IDS }),
    caskFill: varchar("cask_fill", { length: 255, enum: CASK_FILLS }),

    // Materialized fields from child releases
    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    imageUrl: text("image_url"),
    tastingNotes: jsonb("tasting_notes").$type<TastingNotes>(),
    suggestedTags: varchar("suggested_tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    avgRating: doublePrecision("avg_rating"),
    ratingStats: jsonb("rating_stats")
      .default({
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: {
          pass: 0,
          sip: 0,
          savor: 0,
        },
      })
      .notNull()
      .$type<{
        pass: number;
        sip: number;
        savor: number;
        total: number;
        avg: number | null;
        percentage: {
          pass: number;
          sip: number;
          savor: number;
        };
      }>(),
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
  observations: many(bottleObservations),
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
 * Represents a shared canonical release under a parent bottle.
 *
 * Use this table when the distinction should aggregate across users, searches,
 * prices, and stats. Release rows carry the typed identity traits that are not
 * stable on the parent bottle, such as edition, years, ABV, and cask traits.
 *
 * If a detail is exact but not yet strong enough to justify a canonical split,
 * preserve it in bottle_observation first.
 *
 * Examples:
 * 1. Ardbeg Supernova 2019 Release
 *    - Bottle: Ardbeg Supernova
 *    - Release Year: 2019
 *    - ABV: 53.8%
 *    - Release-specific details: ppm, cask types, etc.
 *
 * 2. Springbank 12 Cask Strength Batch 24
 *    - Bottle: Springbank 12 Cask Strength
 *    - Edition: Batch 24
 *    - ABV: 57.2%
 *    - Release-specific details: batch label, exact ABV
 *
 * 3. Maker's Mark Private Selection S2B13
 *    - Bottle: Maker's Mark Private Selection
 *    - Edition: S2B13
 *    - Release-specific details: pick code and other marketed variation
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

export const bottleReleasesRelations = relations(
  bottleReleases,
  ({ one, many }) => ({
    bottle: one(bottles, {
      fields: [bottleReleases.bottleId],
      references: [bottles.id],
    }),
    observations: many(bottleObservations),
    createdBy: one(users, {
      fields: [bottleReleases.createdById],
      references: [users.id],
    }),
  }),
);

export type BottleRelease = typeof bottleReleases.$inferSelect;
export type NewBottleRelease = typeof bottleReleases.$inferInsert;

/**
 * Store-listing evidence attached to a bottle or bottle_release.
 *
 * Today this table is populated from approved store-price matches. It keeps
 * exact listing facts without forcing them into canonical bottle/release rows.
 */
export const bottleObservations = pgTable(
  "bottle_observation",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id,
      { onDelete: "cascade" },
    ),
    sourceType: varchar("source_type", {
      length: 32,
      enum: OBSERVATION_SOURCE_TYPES,
    }).notNull(),
    sourceKey: varchar("source_key", { length: 255 }).notNull(),
    sourceName: varchar("source_name", { length: 255 }).notNull(),
    sourceUrl: text("source_url"),
    externalSiteId: bigint("external_site_id", { mode: "number" }).references(
      () => externalSites.id,
    ),
    rawText: text("raw_text"),
    parsedIdentity: jsonb("parsed_identity").$type<Record<string, unknown>>(),
    facts: jsonb("facts").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
    ),
  },
  (table) => [
    uniqueIndex("bottle_observation_source_idx").on(
      table.sourceType,
      table.sourceKey,
    ),
    index("bottle_observation_bottle_idx").on(table.bottleId),
    index("bottle_observation_release_idx").on(table.releaseId),
    index("bottle_observation_external_site_idx").on(table.externalSiteId),
  ],
);

export const bottleObservationsRelations = relations(
  bottleObservations,
  ({ one }) => ({
    bottle: one(bottles, {
      fields: [bottleObservations.bottleId],
      references: [bottles.id],
    }),
    release: one(bottleReleases, {
      fields: [bottleObservations.releaseId],
      references: [bottleReleases.id],
    }),
    externalSite: one(externalSites, {
      fields: [bottleObservations.externalSiteId],
      references: [externalSites.id],
    }),
    createdBy: one(users, {
      fields: [bottleObservations.createdById],
      references: [users.id],
    }),
  }),
);

export type BottleObservation = typeof bottleObservations.$inferSelect;
export type NewBottleObservation = typeof bottleObservations.$inferInsert;

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
