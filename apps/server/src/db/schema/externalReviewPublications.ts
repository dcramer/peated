import { bigint, pgTable, timestamp } from "drizzle-orm/pg-core";
import { externalSites } from "./externalSites";

/** A review is public only while its source has an approval time. */
export const externalReviewPublications = pgTable(
  "external_review_publication",
  {
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .primaryKey()
      .references(() => externalSites.id, { onDelete: "cascade" }),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export type ExternalReviewPublication =
  typeof externalReviewPublications.$inferSelect;
export type NewExternalReviewPublication =
  typeof externalReviewPublications.$inferInsert;
