import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottleReleases, bottles } from "./bottles";
import { externalSites } from "./externalSites";

export const reviews = pgTable(
  "review",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id)
      .notNull(),
    name: text("name").notNull(),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id,
    ),
    hidden: boolean("hidden").default(false),
    // ratings are 0-100
    rating: integer("rating").notNull(),
    issue: text("issue").notNull(),
    url: text("url").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("review_unq_name").using(
      "btree",
      table.externalSiteId,
      sql`LOWER(${table.name})`,
      table.issue,
    ),
    index("review_bottle_idx").on(table.bottleId),
    index("review_release_idx").on(table.releaseId),
  ],
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  bottle: one(bottles, {
    fields: [reviews.bottleId],
    references: [bottles.id],
  }),
  release: one(bottleReleases, {
    fields: [reviews.releaseId],
    references: [bottleReleases.id],
  }),
  store: one(externalSites, {
    fields: [reviews.externalSiteId],
    references: [externalSites.id],
  }),
}));

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
