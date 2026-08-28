import { z } from "zod";
import {
  SCRAPE_SOURCE_KIND_LIST,
  ScrapeRulesSchema,
} from "../scraper/configured/config";
import { ScrapeSourcePreviewResultSchema } from "../scraper/configured/preview";
import { ExternalSiteKeySchema, ExternalSiteSchema } from "./externalSites";

export { ScrapeRulesSchema } from "../scraper/configured/config";

export const ScrapeSourceCreateSchema = z
  .object({
    key: ExternalSiteKeySchema,
    name: z.string().trim().min(1).max(200),
    kind: z.enum(SCRAPE_SOURCE_KIND_LIST),
    listUrl: z.url(),
    sampleUrls: z.array(z.url()).max(10).default([]),
    allowAiSuggestions: z.boolean().default(false),
  })
  .strict();

const ScrapeSourceRevisionBaseSchema = z.object({
  id: z.number().int().positive(),
  scrapeSourceId: z.number().int().positive(),
  revision: z.number().int().positive(),
  rulesVersion: z.number().int().positive(),
  listUrl: z.url(),
  rules: ScrapeRulesSchema,
  active: z.boolean(),
  previewStatus: z.enum(["pending", "passed", "failed"]),
  previewResult: ScrapeSourcePreviewResultSchema,
  previewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ScrapeSourceRevisionSchema = z.discriminatedUnion("author", [
  ScrapeSourceRevisionBaseSchema.extend({
    author: z.literal("person"),
    aiModel: z.null(),
    aiInstructionsVersion: z.null(),
  }),
  ScrapeSourceRevisionBaseSchema.extend({
    author: z.literal("ai"),
    aiModel: z.string(),
    aiInstructionsVersion: z.string(),
  }),
]);

export const ScrapeSourceSchema = z.object({
  id: z.number().int().positive(),
  site: ExternalSiteSchema,
  kind: z.enum(SCRAPE_SOURCE_KIND_LIST),
  enabled: z.boolean(),
  allowAiSuggestions: z.boolean(),
  listUrl: z.url(),
  sampleUrls: z.array(z.url()),
  activeRevisionId: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revisions: z.array(ScrapeSourceRevisionSchema),
});
