import { z } from "zod";
import { ExternalSiteSchema, ExternalSiteTypeEnum } from "./externalSites";

export const ReviewSchema = z.object({
  id: z.number(),
  name: z.string(),
  rating: z.number(),
  url: z.string(),
  site: ExternalSiteSchema,
  updatedAt: z.string().datetime(),
});

export const ReviewInputSchema = z.object({
  site: ExternalSiteTypeEnum,
  name: z.string().trim().min(1, "Required"),
  rating: z.number(),
  issue: z.string().trim().min(1, "Required"),
  url: z.string().trim().min(1, "Required"),
});
