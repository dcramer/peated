import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bottles } from "./bottles";
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
    // ratings are 0-100
    rating: integer("rating").notNull(),
    issue: text("issue").notNull(),
    url: text("url").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (reviews) => {
    return {
      reviewName: uniqueIndex("store_price_unq_name").on(
        reviews.externalSiteId,
        reviews.name,
        reviews.issue,
      ),
    };
  },
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  bottle: one(bottles, {
    fields: [reviews.bottleId],
    references: [bottles.id],
  }),
  store: one(externalSites, {
    fields: [reviews.externalSiteId],
    references: [externalSites.id],
  }),
}));

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
