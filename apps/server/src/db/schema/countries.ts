import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { geometry_point } from "../columns/geoemetry";
import { contentSourceEnum } from "./enums";

export const countries = pgTable(
  "country",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
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
  (countries) => {
    return {
      nameUnique: uniqueIndex("country_name_unq")
        .on(countries.name)
        .using(sql`btree (LOWER(name))`),
      slugUnique: uniqueIndex("country_slug_unq")
        .on(countries.slug)
        .using(sql`btree (LOWER(slug))`),
    };
  },
);

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;
