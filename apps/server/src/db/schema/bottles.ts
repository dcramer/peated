import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import type {
  BottleExtractedDetails,
  ProposedBottle,
} from "@peated/bottle-classifier/internal/types";
import {
  CASK_FILLS,
  CASK_SIZE_IDS,
  CASK_TYPE_IDS,
} from "@peated/server/constants";
import { tsvector } from "../columns";
import { vector } from "../columns/vector";
import { actors } from "./actors";
import { entities } from "./entities";
import { categoryEnum, contentSourceEnum, flavorProfileEnum } from "./enums";
import { externalSites } from "./externalSites";
import { users } from "./users";

type TastingNotes = {
  nose: string;
  palate: string;
  finish: string;
};

type PersistedObservationValue =
  | boolean
  | null
  | number
  | string
  | PersistedObservationData
  | PersistedObservationValue[];

interface PersistedObservationData {
  [key: string]: PersistedObservationValue;
}

interface StorePriceObservationFacts {
  proposalType: string;
  proposedBottle: PersistedObservationData | ProposedBottle | null;
}

type RatingStats = {
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
};

const DEFAULT_RATING_STATS: RatingStats = {
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
};

const OBSERVATION_SOURCE_TYPES = ["store_price"] as const;
export const BOTTLE_ALIAS_ASSIGNMENT_SOURCES = [
  "legacy",
  "canonical",
  "source_approved",
  "classifier_approved",
  "human_approved",
] as const;
export type BottleAliasAssignmentSource =
  (typeof BOTTLE_ALIAS_ASSIGNMENT_SOURCES)[number];
export const bottleAliasAssignmentSourceEnum = pgEnum(
  "bottle_alias_assignment_source",
  BOTTLE_ALIAS_ASSIGNMENT_SOURCES,
);
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
    createdByActorId: bigint("created_by_actor_id", {
      mode: "number",
    })
      .references(() => actors.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("bottle_series_full_name_key").using(
      "btree",
      sql`LOWER(${table.fullName})`,
    ),
    index("bottle_series_search_idx").using("gin", table.searchVector),
    index("bottle_series_brand_idx").on(table.brandId),
    index("bottle_series_created_by_actor_idx").on(table.createdByActorId),
  ],
);

export type BottleSeries = typeof bottleSeries.$inferSelect;
export type NewBottleSeries = typeof bottleSeries.$inferInsert;

/**
 * Represents one independently complete marketed release.
 *
 * Shared BottleGroup edits are durably materialized here so exact reads never
 * depend on group hydration. Release-specific identity, content, and aggregate
 * state also belong directly to this row.
 */
export const bottles = pgTable(
  "bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    groupId: bigint("group_id", { mode: "number" }).references(
      (): AnyPgColumn => bottleGroups.id,
    ),
    // canonical name including brand
    fullName: varchar("full_name", { length: 255 }).notNull(),
    // canonical name excluding brand
    name: varchar("name", { length: 255 }).notNull(),

    // Effective stated age for this exact marketed Bottle.
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

    // Exact marketed-release identity.
    edition: varchar("edition", { length: 255 }),
    abv: doublePrecision("abv"),
    singleCask: boolean("single_cask"),
    caskStrength: boolean("cask_strength"),
    vintageYear: smallint("vintage_year"),
    releaseYear: smallint("release_year"),
    caskSize: varchar("cask_size", { length: 255, enum: CASK_SIZE_IDS }),
    caskType: varchar("cask_type", { length: 255, enum: CASK_TYPE_IDS }),
    caskFill: varchar("cask_fill", { length: 255, enum: CASK_FILLS }),

    // Exact content and aggregate state.
    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    imageUrl: text("image_url"),
    // A removed image must not return from a StorePrice match.
    rejectedImageUrls: text("rejected_image_urls")
      .array()
      .default(sql`array[]::text[]`)
      .notNull(),
    tastingNotes: jsonb("tasting_notes").$type<TastingNotes>(),
    suggestedTags: varchar("suggested_tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    avgRating: doublePrecision("avg_rating"),
    ratingStats: jsonb("rating_stats")
      .default(DEFAULT_RATING_STATS)
      .notNull()
      .$type<RatingStats>(),
    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),
    // Retained legacy compatibility state; new reads use BottleGroup totals.
    numReleases: bigint("num_releases", { mode: "number" })
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
    unique("bottle_id_group_id_unq").on(table.id, table.groupId),
    index("bottle_group_idx").on(table.groupId),
    index("bottle_search_idx").using("gin", table.searchVector),
    index("bottle_brand_idx").on(table.brandId),
    index("bottle_bottler_idx").on(table.bottlerId),
    index("bottle_created_by_actor_idx").on(table.createdByActorId),
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

/**
 * Owns the shared identity prefix, aggregate statistics, and editing semantics.
 * Member Bottles own their exact presentation and durably materialize shared
 * values; a representative never substitutes for an exact Bottle identity.
 */
export const bottleGroups = pgTable(
  "bottle_group",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    statedAge: smallint("stated_age"),
    seriesId: bigint("series_id", { mode: "number" }).references(
      () => bottleSeries.id,
    ),
    category: categoryEnum("category"),
    brandId: bigint("brand_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
    bottlerId: bigint("bottler_id", { mode: "number" }).references(
      () => entities.id,
    ),
    flavorProfile: flavorProfileEnum("flavor_profile"),
    representativeBottleId: bigint("representative_bottle_id", {
      mode: "number",
    }),
    avgRating: doublePrecision("avg_rating"),
    ratingStats: jsonb("rating_stats")
      .default(DEFAULT_RATING_STATS)
      .notNull()
      .$type<RatingStats>(),
    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),
    totalBottles: bigint("total_bottles", { mode: "number" })
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
    index("bottle_group_brand_idx").on(table.brandId),
    index("bottle_group_bottler_idx").on(table.bottlerId),
    index("bottle_group_series_idx").on(table.seriesId),
    index("bottle_group_category_idx").on(table.category),
    index("bottle_group_representative_bottle_idx").on(
      table.representativeBottleId,
    ),
    index("bottle_group_created_by_actor_idx").on(table.createdByActorId),
    check(
      "bottle_group_stated_age_check",
      sql`${table.statedAge} IS NULL OR (${table.statedAge} >= 0 AND ${table.statedAge} <= 100)`,
    ),
    foreignKey({
      columns: [table.representativeBottleId, table.id],
      foreignColumns: [bottles.id, bottles.groupId],
      name: "bottle_group_representative_membership_fk",
    }),
  ],
);

export type BottleGroup = typeof bottleGroups.$inferSelect;
export type NewBottleGroup = typeof bottleGroups.$inferInsert;

export const bottleGroupDistillers = pgTable(
  "bottle_group_distiller",
  {
    groupId: bigint("group_id", { mode: "number" })
      .references(() => bottleGroups.id)
      .notNull(),
    distillerId: bigint("distiller_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.distillerId] })],
);

export type BottleGroupDistiller = typeof bottleGroupDistillers.$inferSelect;
export type NewBottleGroupDistiller = typeof bottleGroupDistillers.$inferInsert;

export const bottlesRelations = relations(bottles, ({ one, many }) => ({
  group: one(bottleGroups, {
    fields: [bottles.groupId],
    references: [bottleGroups.id],
    relationName: "bottle_group_members",
  }),
  representativeForGroups: many(bottleGroups, {
    relationName: "bottle_group_representative_bottle",
  }),
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
  observations: many(bottleObservations),
  barcodes: many(bottleBarcodes),
  createdByActor: one(actors, {
    fields: [bottles.createdByActorId],
    references: [actors.id],
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
    bottleGroups: many(bottleGroups),
    createdByActor: one(actors, {
      fields: [bottleSeries.createdByActorId],
      references: [actors.id],
    }),
  }),
);

export const bottleGroupsRelations = relations(
  bottleGroups,
  ({ one, many }) => ({
    brand: one(entities, {
      fields: [bottleGroups.brandId],
      references: [entities.id],
      relationName: "bottle_group_brand",
    }),
    bottler: one(entities, {
      fields: [bottleGroups.bottlerId],
      references: [entities.id],
      relationName: "bottle_group_bottler",
    }),
    series: one(bottleSeries, {
      fields: [bottleGroups.seriesId],
      references: [bottleSeries.id],
    }),
    representativeBottle: one(bottles, {
      fields: [bottleGroups.representativeBottleId],
      references: [bottles.id],
      relationName: "bottle_group_representative_bottle",
    }),
    createdByActor: one(actors, {
      fields: [bottleGroups.createdByActorId],
      references: [actors.id],
    }),
    bottles: many(bottles, {
      relationName: "bottle_group_members",
    }),
    distillers: many(bottleGroupDistillers),
  }),
);

export const bottleGroupDistillersRelations = relations(
  bottleGroupDistillers,
  ({ one }) => ({
    group: one(bottleGroups, {
      fields: [bottleGroupDistillers.groupId],
      references: [bottleGroups.id],
    }),
    distiller: one(entities, {
      fields: [bottleGroupDistillers.distillerId],
      references: [entities.id],
    }),
  }),
);

/**
 * Store-listing evidence attached to a Bottle.
 * Listing facts remain separate from canonical Bottle fields.
 */
export const bottleObservations = pgTable(
  "bottle_observation",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),
    // Retained compatibility field for safe migrations; do not use in new logic.
    legacyReleaseId: bigint("release_id", { mode: "number" }),
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
    parsedIdentity: jsonb("parsed_identity").$type<
      BottleExtractedDetails | PersistedObservationData
    >(),
    facts: jsonb("facts").$type<
      PersistedObservationData | StorePriceObservationFacts
    >(),
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
    index("bottle_observation_release_idx").on(table.legacyReleaseId),
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

/**
 * Canonical retail package identifiers for an exact Bottle.
 *
 * Source claims and conflicts remain observations; this table only contains
 * accepted mappings that are safe for deterministic barcode lookup.
 */
export const bottleBarcodes = pgTable(
  "bottle_barcode",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),
    value: varchar("value", { length: 14 }).notNull(),
    gtin14: varchar("gtin14", { length: 14 }).notNull(),
    volume: integer("volume"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByActorId: bigint("created_by_actor_id", {
      mode: "number",
    })
      .references(() => actors.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("bottle_barcode_gtin14_unq").on(table.gtin14),
    index("bottle_barcode_bottle_idx").on(table.bottleId),
    index("bottle_barcode_created_by_actor_idx").on(table.createdByActorId),
    check(
      "bottle_barcode_value_check",
      sql`${table.value} ~ '^[0-9]+$' AND char_length(${table.value}) IN (8, 12, 13, 14)`,
    ),
    check("bottle_barcode_gtin14_check", sql`${table.gtin14} ~ '^[0-9]{14}$'`),
  ],
);

export const bottleBarcodesRelations = relations(bottleBarcodes, ({ one }) => ({
  bottle: one(bottles, {
    fields: [bottleBarcodes.bottleId],
    references: [bottles.id],
  }),
  createdByActor: one(actors, {
    fields: [bottleBarcodes.createdByActorId],
    references: [actors.id],
  }),
}));

export type BottleBarcode = typeof bottleBarcodes.$inferSelect;
export type NewBottleBarcode = typeof bottleBarcodes.$inferInsert;

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
    // Retained compatibility field for safe migrations; do not use in new logic.
    legacyReleaseId: bigint("release_id", { mode: "number" }),
    name: varchar("name", { length: 255 }).notNull(),
    embedding: vector("embedding", { length: 3072 }),
    // Ignored aliases are retained for audit/history but excluded from exact matching.
    ignored: boolean("ignored").default(false),
    assignmentSource: bottleAliasAssignmentSourceEnum("assignment_source")
      .default("legacy")
      .notNull(),
    assignedByActorId: bigint("assigned_by_actor_id", {
      mode: "number",
    })
      .references(() => actors.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bottle_alias_name_idx").using(
      "btree",
      sql`LOWER(${table.name})`,
    ),
    index("bottle_alias_bottle_idx").on(table.bottleId),
    index("bottle_alias_release_idx").on(table.legacyReleaseId),
    index("bottle_alias_assigned_by_actor_idx").on(table.assignedByActorId),
  ],
);

export const bottleAliasesRelations = relations(bottleAliases, ({ one }) => ({
  bottle: one(bottles, {
    fields: [bottleAliases.bottleId],
    references: [bottles.id],
  }),
  assignedByActor: one(actors, {
    fields: [bottleAliases.assignedByActorId],
    references: [actors.id],
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
