import { z } from "zod";
import { EXTERNAL_SITE_TYPE_LIST } from "../constants";

export const ExternalSiteTypeEnum = z.enum(EXTERNAL_SITE_TYPE_LIST);

export const ExternalSiteSchema = z.object({
  id: z.number().describe("Unique identifier for the external site"),
  type: ExternalSiteTypeEnum.describe("Type of external site"),
  name: z.string().describe("Name of the external site"),
  lastRunAt: z
    .string()
    .datetime()
    .nullable()
    .describe("Completion timestamp of the latest terminal scraper run"),
  nextRunAt: z
    .string()
    .datetime()
    .nullable()
    .describe("Timestamp of the next scheduled run"),
  runEvery: z.number().nullable().describe("Interval in minutes between runs"),
});

export const ExternalSiteRunSchema = z.object({
  id: z.number().describe("Unique identifier for this scraper run"),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  trigger: z.enum(["scheduled", "manual"]),
  requestedById: z.number().nullable(),
  attemptCount: z.number().int().min(0),
  itemCount: z.number().int().min(0).nullable(),
  error: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ExternalSiteHealthSchema = ExternalSiteSchema.extend({
  listingCount: z
    .number()
    .int()
    .min(0)
    .describe("Number of visible listings currently owned by the site"),
  latestRun: ExternalSiteRunSchema.nullable(),
  lastSucceededAt: z.string().datetime().nullable(),
});
