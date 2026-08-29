import { z } from "zod";
import { ScrapeSourcePreviewResultSchema } from "../scraper/configured/preview";
import {
  SCRAPE_SOURCE_KIND_LIST,
  ScrapeRulesSchema,
} from "../scraper/configured/rules";
import { ExternalSiteSchema } from "./externalSites";

export { ScrapeRulesSchema } from "../scraper/configured/rules";

export const ScrapeSourceUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "URL must use HTTP or HTTPS.",
  });

export const ScrapeSourceCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kind: z.enum(SCRAPE_SOURCE_KIND_LIST),
    websiteUrl: ScrapeSourceUrlSchema,
    sampleUrls: z.array(ScrapeSourceUrlSchema).max(10).default([]),
  })
  .strict();

const ScrapeSourceRevisionBaseSchema = z
  .object({
    id: z.number().int().positive(),
    scrapeSourceId: z.number().int().positive(),
    revision: z.number().int().positive(),
    rulesVersion: z.number().int().positive(),
    listUrl: ScrapeSourceUrlSchema,
    rules: ScrapeRulesSchema,
    active: z.boolean(),
    previewStatus: z.enum(["pending", "passed", "failed"]),
    previewResult: ScrapeSourcePreviewResultSchema,
    previewedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

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

export const ScrapeSourceSchema = z
  .object({
    id: z.number().int().positive(),
    site: ExternalSiteSchema,
    kind: z.enum(SCRAPE_SOURCE_KIND_LIST),
    enabled: z.boolean(),
    listUrl: ScrapeSourceUrlSchema,
    sampleUrls: z.array(ScrapeSourceUrlSchema),
    activeRevisionId: z.number().int().positive().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    revisions: z.array(ScrapeSourceRevisionSchema),
  })
  .strict();
