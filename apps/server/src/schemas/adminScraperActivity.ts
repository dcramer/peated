import { z } from "zod";
import { ExternalSiteKeySchema } from "./externalSites";

export const AdminScraperHealthCountsSchema = z.object({
  requests: z.number().int().min(0),
  requestErrors: z.number().int().min(0),
  requestErrorsComplete: z.boolean(),
  runs: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
});

export const AdminScraperSavedCountsSchema = z.object({
  total: z.number().int().min(0),
  new: z.number().int().min(0),
  existing: z.number().int().min(0),
});

export const AdminScraperActivitySchema = z.object({
  totals: AdminScraperHealthCountsSchema,
  saved: z.object({
    reviews: AdminScraperSavedCountsSchema,
    prices: AdminScraperSavedCountsSchema,
    catalogListings: AdminScraperSavedCountsSchema,
  }),
  bottleResolution: z.object({
    unknown: z.number().int().min(0),
    created: z.number().int().min(0),
    matched: z.number().int().min(0),
  }),
  days: z.array(
    AdminScraperHealthCountsSchema.extend({
      date: z.string().date(),
      reviews: z.number().int().min(0),
      prices: z.number().int().min(0),
      catalogListings: z.number().int().min(0),
    }),
  ),
  recentFailures: z.array(
    z.object({
      runId: z.number().int().positive(),
      site: z.object({
        key: ExternalSiteKeySchema,
        name: z.string(),
      }),
      error: z.string(),
      completedAt: z.string().datetime(),
    }),
  ),
});
