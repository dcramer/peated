import {
  bigint,
  bigserial,
  doublePrecision,
  pgTable,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Test-only definitions for physical pre-cleanup catalog tables.
 *
 * They intentionally live outside the application schema so runtime queries
 * cannot depend on legacy catalog state while the pre-drop audit remains
 * testable against a database where those tables still exist.
 */
export const bottleReleases = pgTable("bottle_release", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bottleId: bigint("bottle_id", { mode: "number" }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  edition: varchar("edition", { length: 255 }),
  statedAge: smallint("stated_age"),
  vintageYear: smallint("vintage_year"),
  releaseYear: smallint("release_year"),
  abv: doublePrecision("abv"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  createdByActorId: bigint("created_by_actor_id", {
    mode: "number",
  }).notNull(),
});

export const bottleReleasePromotions = pgTable("bottle_release_promotion", {
  releaseId: bigint("release_id", { mode: "number" }).primaryKey(),
  promotedBottleId: bigint("promoted_bottle_id", {
    mode: "number",
  }).notNull(),
});
