import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  check,
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
import { users } from "./users";

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
    // External-site types are validated at application boundaries so adding a
    // scraper does not require a PostgreSQL enum migration.
    type: text("type").$type<string>().notNull(),
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
    requestLimit: integer("request_limit").default(100).notNull(),
    sliceRequestCount: integer("slice_request_count").default(0).notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    rateLimitCount: integer("rate_limit_count").default(0).notNull(),
    emittedItemCount: integer("emitted_item_count").default(0).notNull(),
    cursor: jsonb("cursor"),
    nextAttemptAt: timestamp("next_attempt_at"),
    executionToken: text("execution_token"),
    executionExpiresAt: timestamp("execution_expires_at"),
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
    index("external_site_run_dispatch_idx").on(
      table.status,
      table.nextAttemptAt,
      table.executionExpiresAt,
    ),
    check(
      "external_site_run_request_budget_check",
      sql`${table.requestLimit} > 0
        AND ${table.sliceRequestCount} >= 0
        AND ${table.sliceRequestCount} <= ${table.requestLimit}
        AND ${table.requestCount} >= 0
        AND ${table.retryCount} >= 0
        AND ${table.rateLimitCount} >= 0
        AND ${table.emittedItemCount} >= 0`,
    ),
    check(
      "external_site_run_execution_pair_check",
      sql`(${table.executionToken} IS NULL) = (${table.executionExpiresAt} IS NULL)`,
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
