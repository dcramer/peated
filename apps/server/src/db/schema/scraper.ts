import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { externalSites } from "./externalSites";

export type CachedRobotsRules =
  | { status: "missing" }
  | {
      status: "rules";
      groups: Array<{
        userAgents: string[];
        rules: Array<{ directive: "allow" | "disallow"; path: string }>;
      }>;
    };

export const scrapeOriginRobotsModeEnum = pgEnum("scrape_origin_robots_mode", [
  "enforce",
  "not_applicable",
]);

export const scrapeDefinitionManagerEnum = pgEnum("scrape_definition_manager", [
  "code",
  "admin",
]);

/**
 * Owns shared remote traffic state. A permit lease is short-lived and never
 * spans a database transaction while network I/O is in progress.
 */
export const scrapeTargets = pgTable(
  "scrape_target",
  {
    key: text("key").primaryKey(),
    managedBy: scrapeDefinitionManagerEnum("managed_by")
      .default("code")
      .notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    minimumSpacingMs: integer("minimum_spacing_ms").notNull(),
    requestsPerWindow: integer("requests_per_window").notNull(),
    windowMs: integer("window_ms").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    maxResponseBytes: integer("max_response_bytes").notNull(),
    maxRetries: integer("max_retries").notNull(),
    nextRequestAt: timestamp("next_request_at"),
    blockedUntil: timestamp("blocked_until"),
    windowStartedAt: timestamp("window_started_at"),
    windowRequestCount: integer("window_request_count").default(0).notNull(),
    rateLimitStreak: integer("rate_limit_streak").default(0).notNull(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "scrape_target_policy_check",
      sql`${table.minimumSpacingMs} >= 0
        AND ${table.requestsPerWindow} > 0
        AND ${table.windowMs} > 0
        AND ${table.timeoutMs} > 0
        AND ${table.maxResponseBytes} > 0
        AND ${table.maxRetries} >= 0`,
    ),
    check(
      "scrape_target_counters_check",
      sql`${table.windowRequestCount} >= 0 AND ${table.rateLimitStreak} >= 0`,
    ),
    check(
      "scrape_target_lease_pair_check",
      sql`(${table.leaseToken} IS NULL) = (${table.leaseExpiresAt} IS NULL)`,
    ),
    index("scrape_target_eligibility_idx").on(
      table.enabled,
      table.blockedUntil,
      table.nextRequestAt,
    ),
  ],
);

export const scrapeOrigins = pgTable(
  "scrape_origin",
  {
    origin: text("origin").primaryKey(),
    managedBy: scrapeDefinitionManagerEnum("managed_by")
      .default("code")
      .notNull(),
    targetKey: text("target_key")
      .references(() => scrapeTargets.key, { onDelete: "restrict" })
      .notNull(),
    active: boolean("active").default(true).notNull(),
    robotsMode: scrapeOriginRobotsModeEnum("robots_mode").notNull(),
    robotsRationale: text("robots_rationale"),
    robotsState: jsonb("robots_state").$type<CachedRobotsRules>(),
    robotsFetchedAt: timestamp("robots_fetched_at"),
    robotsExpiresAt: timestamp("robots_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "scrape_origin_value_check",
      sql`${table.origin} ~ '^https?://[^/]+$'`,
    ),
    check(
      "scrape_origin_robots_rationale_check",
      sql`(${table.robotsMode} = 'enforce' AND ${table.robotsRationale} IS NULL)
        OR (${table.robotsMode} = 'not_applicable' AND ${table.robotsRationale} IS NOT NULL)`,
    ),
    check(
      "scrape_origin_robots_cache_check",
      sql`(${table.robotsState} IS NULL
          AND ${table.robotsFetchedAt} IS NULL
          AND ${table.robotsExpiresAt} IS NULL)
        OR (${table.robotsState} IS NOT NULL
          AND ${table.robotsFetchedAt} IS NOT NULL
          AND ${table.robotsExpiresAt} IS NOT NULL
          AND ${table.robotsExpiresAt} > ${table.robotsFetchedAt})`,
    ),
    index("scrape_origin_target_idx").on(table.targetKey, table.active),
  ],
);

export const externalSiteScrapeTargets = pgTable(
  "external_site_scrape_target",
  {
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    targetKey: text("target_key")
      .references(() => scrapeTargets.key, { onDelete: "restrict" })
      .notNull(),
    managedBy: scrapeDefinitionManagerEnum("managed_by")
      .default("code")
      .notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.externalSiteId, table.targetKey] }),
    index("external_site_scrape_target_target_idx").on(
      table.targetKey,
      table.active,
    ),
  ],
);

export type ScrapeTarget = typeof scrapeTargets.$inferSelect;
export type NewScrapeTarget = typeof scrapeTargets.$inferInsert;
export type ScrapeOrigin = typeof scrapeOrigins.$inferSelect;
export type NewScrapeOrigin = typeof scrapeOrigins.$inferInsert;
export type ExternalSiteScrapeTarget =
  typeof externalSiteScrapeTargets.$inferSelect;
