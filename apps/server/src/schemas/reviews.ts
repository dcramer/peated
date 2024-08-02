import { z } from "zod";
import { BottleSchema } from "./bottles";
import { CategoryEnum } from "./common";
import { ExternalSiteSchema, ExternalSiteTypeEnum } from "./externalSites";

export const ReviewSchema = z.object({
  id: z.number(),
  name: z.string(),
  rating: z.number(),
  url: z.string(),
  site: ExternalSiteSchema,
  bottle: BottleSchema.nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ReviewInputSchema = z.object({
  site: ExternalSiteTypeEnum,
  name: z.string().trim().min(1, "Required"),
  category: CategoryEnum.nullable().optional(),
  rating: z.number(),
  issue: z.string().trim().min(1, "Required"),
  url: z.string().trim().min(1, "Required"),
});
