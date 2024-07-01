import { sql } from "drizzle-orm";
import { bigserial, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { geography } from "../columns/geography";

export const countries = pgTable(
  "country",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: text("name").notNull(),
    slug: text("slug").notNull(),

    location: geography("location"),
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
