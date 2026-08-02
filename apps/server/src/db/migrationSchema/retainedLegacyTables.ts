import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
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
import { actors } from "../schema/actors";
import { bottles } from "../schema/bottles";
import { contentSourceEnum } from "../schema/enums";

type TastingNotes = {
  nose: string;
  palate: string;
  finish: string;
};

export const migrationLegacyReleaseRepairReviewResolutionEnum = pgEnum(
  "legacy_release_repair_review_resolution",
  ["allow_create_parent", "blocked", "reuse_existing_parent"],
);

/**
 * Physical compatibility tables retained for safe migration generation until
 * their separately approved cleanup. New application logic must not use them.
 */
export const migrationBottleReleases = pgTable(
  "bottle_release",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id, { onDelete: "cascade" })
      .notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    searchVector: tsvector("search_vector"),
    edition: varchar("edition", { length: 255 }),
    vintageYear: smallint("vintage_year"),
    releaseYear: smallint("release_year"),
    abv: doublePrecision("abv"),
    singleCask: boolean("single_cask"),
    caskStrength: boolean("cask_strength"),
    statedAge: smallint("stated_age"),
    caskSize: varchar("cask_size", { length: 255, enum: CASK_SIZE_IDS }),
    caskType: varchar("cask_type", { length: 255, enum: CASK_TYPE_IDS }),
    caskFill: varchar("cask_fill", { length: 255, enum: CASK_FILLS }),
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

export const migrationBottleReleasePromotions = pgTable(
  "bottle_release_promotion",
  {
    releaseId: bigint("release_id", { mode: "number" }).primaryKey(),
    promotedBottleId: bigint("promoted_bottle_id", {
      mode: "number",
    }).notNull(),
  },
  (table) => [
    index("bottle_release_promotion_bottle_idx").on(table.promotedBottleId),
  ],
);

export const migrationLegacyReleaseRepairReviews = pgTable(
  "legacy_release_repair_review",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    legacyBottleId: bigint("legacy_bottle_id", { mode: "number" }).notNull(),
    proposedParentFullName: varchar("proposed_parent_full_name", {
      length: 255,
    }).notNull(),
    legacyBottleFingerprint: varchar("legacy_bottle_fingerprint", {
      length: 40,
    }),
    parentCandidatesFingerprint: varchar("parent_candidates_fingerprint", {
      length: 40,
    }),
    releaseEdition: varchar("release_edition", { length: 255 }),
    releaseYear: integer("release_year"),
    resolution:
      migrationLegacyReleaseRepairReviewResolutionEnum("resolution").notNull(),
    reviewedParentBottleId: bigint("reviewed_parent_bottle_id", {
      mode: "number",
    }),
    blockedReason: text("blocked_reason"),
    reviewVersion: integer("review_version").default(1).notNull(),
    reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("legacy_release_repair_review_bottle_idx").on(
      table.legacyBottleId,
    ),
    index("legacy_release_repair_review_parent_idx").on(
      table.reviewedParentBottleId,
    ),
    index("legacy_release_repair_review_resolution_idx").on(table.resolution),
  ],
);
