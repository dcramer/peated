import {
  bigint,
  bigserial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { EXTERNAL_SITE_TYPE_LIST } from "../../constants";

export const externalSiteTypeEnum = pgEnum(
  "external_site_type",
  EXTERNAL_SITE_TYPE_LIST,
);

export const externalSites = pgTable(
  "external_site",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: externalSiteTypeEnum("type").notNull(),
    name: text("name").notNull(),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    // minutes
    runEvery: integer("run_every").default(60),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("external_site_type").on(table.type)],
);

export type ExternalSite = typeof externalSites.$inferSelect;
export type NewExternalSite = typeof externalSites.$inferInsert;

export const externalSiteConfig = pgTable(
  "external_site_config",
  {
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id)
      .notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    value: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.externalSiteId, table.key] })],
);

export type ExternalSiteConfig = typeof externalSiteConfig.$inferSelect;
export type NewExternalSiteConfig = typeof externalSiteConfig.$inferInsert;
