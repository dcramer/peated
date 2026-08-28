import { z } from "zod";
import { ConfiguredScraperConfigSchema } from "../scraper/configured/config";
import { ConfiguredScraperValidationSchema } from "../scraper/configured/validation";
import { ExternalSiteKeySchema, ExternalSiteSchema } from "./externalSites";

export { ConfiguredScraperConfigSchema } from "../scraper/configured/config";

export const ConfiguredScraperCreateSchema = z
  .object({
    key: ExternalSiteKeySchema,
    name: z.string().trim().min(1).max(200),
    collection: z.enum(["reviews", "store_prices"]),
    indexUrl: z.url(),
    sampleUrls: z.array(z.url()).max(10).default([]),
    allowLlmProcessing: z.boolean().default(false),
  })
  .strict();

const ConfiguredScraperVersionBaseSchema = z.object({
  id: z.number().int().positive(),
  configuredScraperId: z.number().int().positive(),
  version: z.number().int().positive(),
  config: ConfiguredScraperConfigSchema,
  engineVersion: z.number().int().positive(),
  validationStatus: z.enum(["pending", "passed", "failed"]),
  validationResult: ConfiguredScraperValidationSchema,
  validatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ConfiguredScraperVersionSchema = z.discriminatedUnion(
  "createdWith",
  [
    ConfiguredScraperVersionBaseSchema.extend({
      createdWith: z.literal("person"),
      model: z.null(),
      promptVersion: z.null(),
    }),
    ConfiguredScraperVersionBaseSchema.extend({
      createdWith: z.literal("ai"),
      model: z.string(),
      promptVersion: z.string(),
    }),
  ],
);

export const ConfiguredScraperSchema = z.object({
  id: z.number().int().positive(),
  site: ExternalSiteSchema,
  collection: z.enum(["reviews", "store_prices"]),
  enabled: z.boolean(),
  allowLlmProcessing: z.boolean(),
  indexUrl: z.url(),
  sampleUrls: z.array(z.url()),
  activeConfigVersionId: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versions: z.array(ConfiguredScraperVersionSchema),
});
