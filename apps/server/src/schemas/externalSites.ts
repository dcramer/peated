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
    .describe("Timestamp of the last scraping run"),
  nextRunAt: z
    .string()
    .datetime()
    .nullable()
    .describe("Timestamp of the next scheduled run"),
  runEvery: z.number().nullable().describe("Interval in minutes between runs"),
});

export const ExternalSiteInputSchema = z.object({
  type: ExternalSiteTypeEnum.describe("Type of external site"),
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Name of the external site"),
  runEvery: z
    .number()
    .nullable()
    .default(null)
    .describe("Interval in minutes between runs"),
});
