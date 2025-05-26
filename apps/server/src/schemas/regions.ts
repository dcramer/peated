import { z } from "zod";
import { ContentSourceEnum } from "./common";
import { CountrySchema } from "./countries";
import { PointSchema } from "./shared";

export const RegionSchema = z.object({
  id: z.number().describe("Unique identifier for the region"),
  name: z.string().trim().min(1, "Required").describe("Name of the region"),
  slug: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("URL-friendly slug for the region"),
  country: CountrySchema.describe("Country this region belongs to"),
  description: z
    .string()
    .nullish()
    .describe("Detailed description of the region's whisky characteristics"),
  location: PointSchema.nullish().describe(
    "Geographic coordinates of the region",
  ),
  totalBottles: z.number().describe("Total number of bottles from this region"),
  totalDistillers: z
    .number()
    .describe("Total number of distilleries in this region"),
});

export const RegionInputSchema = z.object({
  name: z.string().trim().min(1, "Required").describe("Name of the region"),
  country: z.number().describe("ID of the country this region belongs to"),
  description: z
    .string()
    .trim()
    .nullish()
    .describe("Detailed description of the region's whisky characteristics"),
  descriptionSrc: ContentSourceEnum.nullish().describe(
    "Source of the region description",
  ),
});
