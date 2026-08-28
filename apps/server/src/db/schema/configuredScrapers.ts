import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ConfiguredScraperConfig } from "../../scraper/configured/config";
import type { ConfiguredScraperValidation } from "../../scraper/configured/validation";
import { externalSiteRuns, externalSites } from "./externalSites";
import { users } from "./users";

export const configuredScraperCollectionEnum = pgEnum(
  "configured_scraper_collection",
  ["reviews", "store_prices"],
);

export const configuredScraperVersionOriginEnum = pgEnum(
  "configured_scraper_version_origin",
  ["manual", "llm"],
);

export const configuredScraperValidationStatusEnum = pgEnum(
  "configured_scraper_validation_status",
  ["pending", "passed", "failed"],
);

export const configuredScraperRunPurposeEnum = pgEnum(
  "configured_scraper_run_purpose",
  ["collect", "preview", "generate"],
);

export const configuredScrapers = pgTable(
  "configured_scraper",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    collection: configuredScraperCollectionEnum("collection").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    allowLlmProcessing: boolean("allow_llm_processing")
      .default(false)
      .notNull(),
    indexUrl: text("index_url").notNull(),
    sampleUrls: jsonb("sample_urls").$type<string[]>().default([]).notNull(),
    runEvery: integer("run_every"),
    nextRunAt: timestamp("next_run_at"),
    activeConfigVersionId: bigint("active_config_version_id", {
      mode: "number",
    }).references((): AnyPgColumn => configuredScraperConfigVersions.id, {
      onDelete: "set null",
    }),
    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("configured_scraper_site_collection_unq").on(
      table.externalSiteId,
      table.collection,
    ),
    check(
      "configured_scraper_run_every_check",
      sql`${table.runEvery} IS NULL OR ${table.runEvery} > 0`,
    ),
  ],
);

export const configuredScraperConfigVersions = pgTable(
  "configured_scraper_config_version",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    configuredScraperId: bigint("configured_scraper_id", { mode: "number" })
      .references(() => configuredScrapers.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    config: jsonb("config").$type<ConfiguredScraperConfig>().notNull(),
    origin: configuredScraperVersionOriginEnum("origin").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version"),
    engineVersion: integer("engine_version").notNull(),
    validationStatus: configuredScraperValidationStatusEnum("validation_status")
      .default("pending")
      .notNull(),
    validationResult: jsonb("validation_result")
      .$type<ConfiguredScraperValidation>()
      .notNull(),
    validatedAt: timestamp("validated_at"),
    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("configured_scraper_config_version_unq").on(
      table.configuredScraperId,
      table.version,
    ),
    index("configured_scraper_config_version_created_idx").on(
      table.configuredScraperId,
      table.createdAt,
    ),
    check(
      "configured_scraper_config_version_number_check",
      sql`${table.version} > 0 AND ${table.engineVersion} > 0`,
    ),
    check(
      "configured_scraper_config_version_llm_metadata_check",
      sql`(${table.origin} = 'manual' AND ${table.model} IS NULL AND ${table.promptVersion} IS NULL)
        OR (${table.origin} = 'llm' AND ${table.model} IS NOT NULL AND ${table.promptVersion} IS NOT NULL)`,
    ),
  ],
);

/** Pins each configured run to one immutable config version. */
export const configuredScraperRuns = pgTable(
  "configured_scraper_run",
  {
    externalSiteRunId: bigint("external_site_run_id", { mode: "number" })
      .primaryKey()
      .references(() => externalSiteRuns.id, { onDelete: "cascade" }),
    configuredScraperId: bigint("configured_scraper_id", { mode: "number" })
      .references(() => configuredScrapers.id, { onDelete: "cascade" })
      .notNull(),
    configVersionId: bigint("config_version_id", { mode: "number" }).references(
      () => configuredScraperConfigVersions.id,
      {
        onDelete: "restrict",
      },
    ),
    purpose: configuredScraperRunPurposeEnum("purpose").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("configured_scraper_run_config_idx").on(
      table.configuredScraperId,
      table.configVersionId,
    ),
    check(
      "configured_scraper_run_version_check",
      sql`${table.purpose}::text = 'generate' OR ${table.configVersionId} IS NOT NULL`,
    ),
  ],
);

export type ConfiguredScraper = typeof configuredScrapers.$inferSelect;
export type NewConfiguredScraper = typeof configuredScrapers.$inferInsert;
export type ConfiguredScraperConfigVersion =
  typeof configuredScraperConfigVersions.$inferSelect;
export type NewConfiguredScraperConfigVersion =
  typeof configuredScraperConfigVersions.$inferInsert;
