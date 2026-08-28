import { z } from "zod";
import {
  SCRAPE_SOURCE_KIND_LIST,
  ScrapeRulesSchema,
} from "../scraper/configured/config";
import { ScrapeSourceValidationSchema } from "../scraper/configured/validation";
import { ExternalSiteKeySchema, ExternalSiteSchema } from "./externalSites";

export { ScrapeRulesSchema } from "../scraper/configured/config";

export const ScrapeSourceCreateSchema = z
  .object({
    key: ExternalSiteKeySchema,
    name: z.string().trim().min(1).max(200),
    kind: z.enum(SCRAPE_SOURCE_KIND_LIST),
    listUrl: z.url(),
    sampleUrls: z.array(z.url()).max(10).default([]),
    allowLlmProcessing: z.boolean().default(false),
  })
  .strict();

const ScrapeSourceRevisionBaseSchema = z.object({
  id: z.number().int().positive(),
  scrapeSourceId: z.number().int().positive(),
  revision: z.number().int().positive(),
  formatVersion: z.number().int().positive(),
  listUrl: z.url(),
  rules: ScrapeRulesSchema,
  active: z.boolean(),
  validationStatus: z.enum(["pending", "passed", "failed"]),
  validationResult: ScrapeSourceValidationSchema,
  validatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ScrapeSourceRevisionSchema = z.discriminatedUnion("createdWith", [
  ScrapeSourceRevisionBaseSchema.extend({
    createdWith: z.literal("person"),
    model: z.null(),
    promptVersion: z.null(),
  }),
  ScrapeSourceRevisionBaseSchema.extend({
    createdWith: z.literal("ai"),
    model: z.string(),
    promptVersion: z.string(),
  }),
]);

export const ScrapeSourceSchema = z.object({
  id: z.number().int().positive(),
  site: ExternalSiteSchema,
  kind: z.enum(SCRAPE_SOURCE_KIND_LIST),
  enabled: z.boolean(),
  allowLlmProcessing: z.boolean(),
  listUrl: z.url(),
  sampleUrls: z.array(z.url()),
  activeRevisionId: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revisions: z.array(ScrapeSourceRevisionSchema),
});
