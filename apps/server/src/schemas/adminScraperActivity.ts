import { z } from "zod";
import { ExternalSiteKeySchema } from "./externalSites";

export const AdminScraperActivityCountsSchema = z.object({
  requests: z.number().int().min(0),
  requestErrors: z.number().int().min(0),
  requestErrorsComplete: z.boolean(),
  runs: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  records: z.number().int().min(0),
  newRecords: z.number().int().min(0),
  existingRecords: z.number().int().min(0),
  untrackedRecords: z.number().int().min(0),
});

export const AdminScraperRecordTypeSchema = z.enum([
  "review",
  "price",
  "catalog",
  "bottle",
  "untracked",
]);

export const AdminScraperActivitySchema = z.object({
  days: z.array(
    AdminScraperActivityCountsSchema.extend({
      date: z.string().date(),
    }),
  ),
  totals: AdminScraperActivityCountsSchema,
  recordTypes: z.array(
    AdminScraperActivityCountsSchema.pick({
      records: true,
      newRecords: true,
      existingRecords: true,
      untrackedRecords: true,
    }).extend({ type: AdminScraperRecordTypeSchema }),
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
