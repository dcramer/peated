import {
  bigserial,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
  (externalSites) => {
    return {
      type: uniqueIndex("external_site_type").on(externalSites.type),
    };
  },
);

export type ExternalSite = typeof externalSites.$inferSelect;
export type NewExternalSite = typeof externalSites.$inferInsert;
