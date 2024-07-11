import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  char,
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
    alpha2: char("alpha2", {
      length: 2,
    }),
    location: geometry_point("location"),
    description: text("description"),
    descriptionSrc: contentSourceEnum("description_src"),
    summary: text("summary"),
    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    totalDistillers: bigint("total_distillers", { mode: "number" })
      .default(0)
      .notNull(),
  },
  (table) => {
    return {
      nameUnique: uniqueIndex("country_name_unq").using(
        "btree",
        sql`LOWER(${table.name})`,
      ),
      slugUnique: uniqueIndex("country_slug_unq").using(
        "btree",
        sql`LOWER(${table.slug})`,
      ),
    };
  },
);

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;
