import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  index,
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
import { users } from "./users";

export const externalSiteTypeEnum = pgEnum(
  "external_site_type",
  EXTERNAL_SITE_TYPE_LIST,
);

export const externalSiteRunStatusEnum = pgEnum("external_site_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const externalSiteRunTriggerEnum = pgEnum("external_site_run_trigger", [
  "scheduled",
  "manual",
]);

export const externalSites = pgTable(
  "external_site",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: externalSiteTypeEnum("type").notNull(),
    name: text("name").notNull(),
    lastRunAt: timestamp("last_run_at"),
    lastRunId: bigint("last_run_id", { mode: "number" }).references(
      (): AnyPgColumn => externalSiteRuns.id,
      { onDelete: "set null" },
    ),
    nextRunAt: timestamp("next_run_at"),
    // minutes
    runEvery: integer("run_every").default(60),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("external_site_type").on(table.type)],
);

export type ExternalSite = typeof externalSites.$inferSelect;
export type NewExternalSite = typeof externalSites.$inferInsert;

export const externalSiteRuns = pgTable(
  "external_site_run",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    status: externalSiteRunStatusEnum("status").default("queued").notNull(),
    trigger: externalSiteRunTriggerEnum("trigger").notNull(),
    requestedById: bigint("requested_by_id", { mode: "number" }).references(
      () => users.id,
    ),
    attemptCount: integer("attempt_count").default(0).notNull(),
    itemCount: integer("item_count"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("external_site_run_active_unq")
      .on(table.externalSiteId)
      .where(sql`${table.status} IN ('queued', 'running')`),
    index("external_site_run_site_created_idx").on(
      table.externalSiteId,
      table.createdAt,
    ),
    index("external_site_run_site_status_completed_idx").on(
      table.externalSiteId,
      table.status,
      table.completedAt,
    ),
  ],
);

export type ExternalSiteRun = typeof externalSiteRuns.$inferSelect;
export type NewExternalSiteRun = typeof externalSiteRuns.$inferInsert;

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
