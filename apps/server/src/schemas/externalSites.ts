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

export const ExternalSiteInputSchema = z.object({
  type: ExternalSiteTypeEnum,
  name: z.string().trim().min(1, "Required"),
  runEvery: z.number().nullable().default(null),
});
