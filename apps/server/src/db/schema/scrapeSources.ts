import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ScrapeSourcePreviewResult } from "../../scraper/configured/preview";
import {
  type ScrapeRules,
  SCRAPE_SOURCE_KIND_LIST,
} from "../../scraper/configured/rules";
import { externalSiteRuns, externalSites } from "./externalSites";
import { users } from "./users";

// TODO(scraper-platform): Add event after scraped-event match and update rules are defined.
export const scrapeSourceKindEnum = pgEnum(
  "scrape_source_kind",
  SCRAPE_SOURCE_KIND_LIST,
);

export const scrapeSourceRevisionAuthorEnum = pgEnum(
  "scrape_source_revision_author",
  ["person", "ai"],
);

export const scrapeSourcePreviewStatusEnum = pgEnum(
  "scrape_source_preview_status",
  ["pending", "passed", "failed"],
);

export const scrapeSourceRunPurposeEnum = pgEnum("scrape_source_run_purpose", [
  "collect",
  "preview",
  "suggest",
]);

export const scrapeSources = pgTable(
  "scrape_source",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id, { onDelete: "cascade" })
      .notNull(),
    kind: scrapeSourceKindEnum("kind").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    allowAiSuggestions: boolean("allow_ai_suggestions")
      .default(false)
      .notNull(),
    listUrl: text("list_url").notNull(),
    sampleUrls: jsonb("sample_urls").$type<string[]>().default([]).notNull(),
    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("scrape_source_site_unq").on(table.externalSiteId)],
);

export const scrapeSourceRevisions = pgTable(
  "scrape_source_revision",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scrapeSourceId: bigint("scrape_source_id", { mode: "number" })
      .references(() => scrapeSources.id, { onDelete: "cascade" })
      .notNull(),
    revision: integer("revision").notNull(),
    rulesVersion: integer("rules_version").notNull(),
    listUrl: text("list_url").notNull(),
    rules: jsonb("rules").$type<ScrapeRules>().notNull(),
    author: scrapeSourceRevisionAuthorEnum("author").notNull(),
    aiModel: text("ai_model"),
    aiInstructionsVersion: text("ai_instructions_version"),
    active: boolean("active").default(false).notNull(),
    previewStatus: scrapeSourcePreviewStatusEnum("preview_status")
      .default("pending")
      .notNull(),
    previewResult: jsonb("preview_result")
      .$type<ScrapeSourcePreviewResult>()
      .notNull(),
    previewedAt: timestamp("previewed_at"),
    createdById: bigint("created_by_id", { mode: "number" }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("scrape_source_revision_number_unq").on(
      table.scrapeSourceId,
      table.revision,
    ),
    unique("scrape_source_revision_id_source_unq").on(
      table.id,
      table.scrapeSourceId,
    ),
    uniqueIndex("scrape_source_revision_active_unq")
      .on(table.scrapeSourceId)
      .where(sql`${table.active} = true`),
    check(
      "scrape_source_revision_numbers_check",
      sql`${table.revision} > 0 AND ${table.rulesVersion} > 0`,
    ),
    check(
      "scrape_source_revision_ai_details_check",
      sql`(${table.author} = 'person' AND ${table.aiModel} IS NULL AND ${table.aiInstructionsVersion} IS NULL)
        OR (${table.author} = 'ai' AND ${table.aiModel} IS NOT NULL AND ${table.aiInstructionsVersion} IS NOT NULL)`,
    ),
  ],
);

/** Links a site run to one source and, except for AI suggestions, one revision. */
export const scrapeSourceRuns = pgTable(
  "scrape_source_run",
  {
    externalSiteRunId: bigint("external_site_run_id", { mode: "number" })
      .primaryKey()
      .references(() => externalSiteRuns.id, { onDelete: "cascade" })
      .notNull(),
    scrapeSourceId: bigint("scrape_source_id", { mode: "number" })
      .references(() => scrapeSources.id, { onDelete: "cascade" })
      .notNull(),
    revisionId: bigint("revision_id", { mode: "number" }),
    purpose: scrapeSourceRunPurposeEnum("purpose").notNull(),
  },
  (table) => [
    foreignKey({
      name: "scrape_source_run_revision_fk",
      columns: [table.revisionId, table.scrapeSourceId],
      foreignColumns: [
        scrapeSourceRevisions.id,
        scrapeSourceRevisions.scrapeSourceId,
      ],
    }).onDelete("restrict"),
    index("scrape_source_run_source_revision_idx").on(
      table.scrapeSourceId,
      table.revisionId,
    ),
    check(
      "scrape_source_run_revision_check",
      sql`${table.purpose} = 'suggest' OR ${table.revisionId} IS NOT NULL`,
    ),
  ],
);

export type ScrapeSource = typeof scrapeSources.$inferSelect;
export type NewScrapeSource = typeof scrapeSources.$inferInsert;
export type ScrapeSourceRevision = typeof scrapeSourceRevisions.$inferSelect;
export type NewScrapeSourceRevision = typeof scrapeSourceRevisions.$inferInsert;
