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
export const bottleReleasePromotionStatusEnum = pgEnum(
  "bottle_release_promotion_status",
  ["pending", "promoted", "failed"],
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
 * Owns generic identity, aggregate presentation, and shared editing semantics.
 * Member Bottles durably materialize shared values; any representative must be
 * a member and does not substitute for an exact Bottle identity.
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

/** Prevents duplicate generic and exact targets and constrains exact membership. */
export const catalogTargets = pgTable(
  "catalog_target",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    groupId: bigint("bottle_group_id", { mode: "number" })
      .references(() => bottleGroups.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("catalog_target_generic_group_unq")
      .on(table.groupId)
      .where(sql`${table.bottleId} IS NULL`),
    uniqueIndex("catalog_target_bottle_unq").on(table.bottleId),
    index("catalog_target_group_idx").on(table.groupId),
    foreignKey({
      columns: [table.bottleId, table.groupId],
      foreignColumns: [bottles.id, bottles.groupId],
      name: "catalog_target_bottle_membership_fk",
    }).onUpdate("cascade"),
  ],
);

export type CatalogTarget = typeof catalogTargets.$inferSelect;
export type NewCatalogTarget = typeof catalogTargets.$inferInsert;

export const bottleGroupTombstones = pgTable(
  "bottle_group_tombstone",
  {
    groupId: bigint("bottle_group_id", { mode: "number" }).primaryKey(),
    newGroupId: bigint("new_bottle_group_id", { mode: "number" })
      .references(() => bottleGroups.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByActorId: bigint("created_by_actor_id", { mode: "number" })
      .references(() => actors.id)
      .notNull(),
  },
  (table) => [
    index("bottle_group_tombstone_new_group_idx").on(table.newGroupId),
    index("bottle_group_tombstone_created_by_actor_idx").on(
      table.createdByActorId,
    ),
  ],
);

export type BottleGroupTombstone = typeof bottleGroupTombstones.$inferSelect;
export type NewBottleGroupTombstone = typeof bottleGroupTombstones.$inferInsert;

export const bottlesRelations = relations(bottles, ({ one, many }) => ({
  group: one(bottleGroups, {
    fields: [bottles.groupId],
    references: [bottleGroups.id],
    relationName: "bottle_group_members",
  }),
  representativeForGroups: many(bottleGroups, {
    relationName: "bottle_group_representative_bottle",
  }),
  exactTarget: one(catalogTargets, {
    fields: [bottles.id, bottles.groupId],
    references: [catalogTargets.bottleId, catalogTargets.groupId],
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
  releases: many(bottleReleases),
  observations: many(bottleObservations),
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
    targets: many(catalogTargets),
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

export const catalogTargetsRelations = relations(catalogTargets, ({ one }) => ({
  group: one(bottleGroups, {
    fields: [catalogTargets.groupId],
    references: [bottleGroups.id],
  }),
  bottle: one(bottles, {
    fields: [catalogTargets.bottleId],
    references: [bottles.id],
  }),
}));

export const bottleGroupTombstonesRelations = relations(
  bottleGroupTombstones,
  ({ one }) => ({
    newGroup: one(bottleGroups, {
      fields: [bottleGroupTombstones.newGroupId],
      references: [bottleGroups.id],
    }),
    createdByActor: one(actors, {
      fields: [bottleGroupTombstones.createdByActorId],
      references: [actors.id],
    }),
  }),
);

/**
 * Legacy compatibility schema retained for the staged migration.
 * Canonical marketed releases are Bottle rows; OpenSpec tasks 9.6 and 9.7
 * remove this table after its remaining compatibility readers and writers.
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
    createdByActorId: bigint("created_by_actor_id", {
      mode: "number",
    })
      .references(() => actors.id)
      .notNull(),
  },
  (table) => [
    index("bottle_release_bottle_idx").on(table.bottleId),
    index("bottle_release_created_by_actor_idx").on(table.createdByActorId),
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
    createdByActor: one(actors, {
      fields: [bottleReleases.createdByActorId],
      references: [actors.id],
    }),
  }),
);

export type BottleRelease = typeof bottleReleases.$inferSelect;
export type NewBottleRelease = typeof bottleReleases.$inferInsert;

/**
 * Retains one audited mapping per legacy release throughout compatibility.
 * Exact Bottle merges may make multiple legacy releases converge on one Bottle.
 */
export const bottleReleasePromotions = pgTable(
  "bottle_release_promotion",
  {
    releaseId: bigint("release_id", { mode: "number" })
      .references(() => bottleReleases.id)
      .primaryKey(),
    promotedBottleId: bigint("promoted_bottle_id", {
      mode: "number",
    }).references(() => bottles.id),
    status: bottleReleasePromotionStatusEnum("status")
      .default("pending")
      .notNull(),
    auditMetadata: jsonb("audit_metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdByActorId: bigint("created_by_actor_id", {
      mode: "number",
    }).references(() => actors.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bottle_release_promotion_bottle_idx").on(table.promotedBottleId),
    index("bottle_release_promotion_status_idx").on(table.status),
    index("bottle_release_promotion_created_by_actor_idx").on(
      table.createdByActorId,
    ),
  ],
);

export const bottleReleasePromotionsRelations = relations(
  bottleReleasePromotions,
  ({ one }) => ({
    legacyRelease: one(bottleReleases, {
      fields: [bottleReleasePromotions.releaseId],
      references: [bottleReleases.id],
    }),
    promotedBottle: one(bottles, {
      fields: [bottleReleasePromotions.promotedBottleId],
      references: [bottles.id],
    }),
    createdByActor: one(actors, {
      fields: [bottleReleasePromotions.createdByActorId],
      references: [actors.id],
    }),
  }),
);

export type BottleReleasePromotion =
  typeof bottleReleasePromotions.$inferSelect;
export type NewBottleReleasePromotion =
  typeof bottleReleasePromotions.$inferInsert;

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
    targetId: bigint("target_id", { mode: "number" }).references(
      () => catalogTargets.id,
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
    index("bottle_observation_target_idx").on(table.targetId),
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
    target: one(catalogTargets, {
      fields: [bottleObservations.targetId],
      references: [catalogTargets.id],
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
    targetId: bigint("target_id", { mode: "number" }).references(
      () => catalogTargets.id,
    ),
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
    index("bottle_alias_release_idx").on(table.releaseId),
    index("bottle_alias_target_idx").on(table.targetId),
    index("bottle_alias_assigned_by_actor_idx").on(table.assignedByActorId),
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
  target: one(catalogTargets, {
    fields: [bottleAliases.targetId],
    references: [catalogTargets.id],
  }),
  assignedByActor: one(actors, {
    fields: [bottleAliases.assignedByActorId],
    references: [actors.id],
  }),
}));

export type BottleAlias = typeof bottleAliases.$inferSelect;
export type NewBottleAlias = typeof bottleAliases.$inferInsert;

export const bottleTombstones = pgTable(
  "bottle_tombstone",
  {
    bottleId: bigint("bottle_id", { mode: "number" }).primaryKey(),
    // A deletion has no successor; otherwise Bottle and group destinations are exclusive.
    newBottleId: bigint("new_bottle_id", { mode: "number" }),
    newGroupId: bigint("new_bottle_group_id", { mode: "number" }).references(
      () => bottleGroups.id,
    ),
  },
  (table) => [
    index("bottle_tombstone_new_group_idx").on(table.newGroupId),
    check(
      "bottle_tombstone_destination_check",
      sql`NOT (${table.newBottleId} IS NOT NULL AND ${table.newGroupId} IS NOT NULL)`,
    ),
  ],
);

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
    newGroup: one(bottleGroups, {
      fields: [bottleTombstones.newGroupId],
      references: [bottleGroups.id],
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
