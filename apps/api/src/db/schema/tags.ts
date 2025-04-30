import { sql } from "drizzle-orm";
import { pgTable, varchar } from "drizzle-orm/pg-core";
import { flavorProfileEnum, tagCategoryEnum } from "./enums";

export const tags = pgTable("tag", {
  name: varchar("name", { length: 64 }).notNull().primaryKey(),
  synonyms: varchar("synonyms", { length: 64 })
    .array()
    .default(sql`'{}'`)
    .notNull(),
  tagCategory: tagCategoryEnum("tag_category").notNull(),
  flavorProfiles: flavorProfileEnum("flavor_profile")
    .array()
    .default(sql`'{}'`)
    .notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
