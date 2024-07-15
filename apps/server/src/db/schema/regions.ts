import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { geometry_point } from "../columns/geoemetry";
import { countries } from "./countries";
import { contentSourceEnum } from "./enums";

export const regions = pgTable(
  "region",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    countryId: bigint("country_id", { mode: "number" })
      .references(() => countries.id)
      .notNull(),
    location: geometry_point("location"),
    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    totalDistillers: bigint("total_distillers", { mode: "number" })
      .default(0)
      .notNull(),
  },
  (table) => {
    return {
      nameUnique: uniqueIndex("region_name_unq").using(
        "btree",
        table.countryId,
        sql`LOWER(${table.name})`,
      ),
      slugUnique: uniqueIndex("region_slug_unq").using(
        "btree",
        table.countryId,
        sql`LOWER(${table.slug})`,
      ),
      countryId: index("region_country_idx").on(table.countryId),
    };
  },
);

export const regionsRelations = relations(regions, ({ one, many }) => ({
  country: one(countries, {
    fields: [regions.countryId],
    references: [countries.id],
  }),
}));

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
