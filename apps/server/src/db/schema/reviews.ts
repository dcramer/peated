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
    hidden: boolean("hidden").default(false),
    // ratings are 0-100
    rating: integer("rating").notNull(),
    issue: text("issue").notNull(),
    url: text("url").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      nameUnique: uniqueIndex("review_unq_name").using(
        "btree",
        // @ts-expect-error: drizzle doesnt seem to understand its own types yet
        table.externalSiteId,
        sql`LOWER(${table.name})`,
        table.issue,
      ),
      bottleIdx: index("review_bottle_idx").on(table.bottleId),
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
