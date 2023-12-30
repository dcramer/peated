import { z } from "zod";
import { EXTERNAL_SITE_TYPE_LIST } from "../constants";

export const ExternalSiteTypeEnum = z.enum(EXTERNAL_SITE_TYPE_LIST);

export const ExternalSiteSchema = z.object({
  id: z.number(),
  type: ExternalSiteTypeEnum,
  name: z.string(),
  lastRunAt: z.string().datetime().nullable(),
  nextRunAt: z.string().datetime().nullable(),
  runEvery: z.number().nullable(),
});

export const ExternalSiteSchemaInputSchema = z.object({
  type: ExternalSiteTypeEnum,
  name: z.string().trim().min(1, "Required"),
  country: z.string().nullable().optional(),
  runEvery: z.number().nullable().optional(),
});
