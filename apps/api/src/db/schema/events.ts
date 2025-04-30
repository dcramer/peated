import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { geometry_point } from "../columns";
import { countries } from "./countries";

export const events = pgTable(
  "event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),

    dateStart: date("date_start").notNull(),
    dateEnd: date("date_end"),

    description: text("description"),
    website: varchar("website", { length: 255 }),

    countryId: bigint("country_id", { mode: "number" }).references(
      () => countries.id,
    ),
    address: text("address"),
    location: geometry_point("location"),

    repeats: boolean("repeats").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_name_unq").using(
      "btree",
      table.dateStart,
      sql`LOWER(${table.name})`,
    ),
    index("event_country_id").on(table.countryId),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
