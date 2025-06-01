import { z } from "zod";
import { ContentSourceEnum } from "./common";
import { PointSchema } from "./shared";

export const CountrySchema = z.object({
  id: z.number().describe("Unique identifier for the country"),
  name: z.string().trim().min(1, "Required").describe("Name of the country"),
  slug: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("URL-friendly slug for the country"),
  description: z
    .string()
    .nullish()
    .describe("Detailed description of the country's whisky heritage"),
  summary: z.string().trim().nullish().describe("Brief summary of the country"),
  location: PointSchema.nullish().describe(
    "Geographic coordinates of the country"
  ),
  totalBottles: z
    .number()
    .describe("Total number of bottles from this country"),
  totalDistillers: z
    .number()
    .describe("Total number of distilleries in this country"),
});

export const CountryInputSchema = z.object({
  name: z.string().trim().min(1, "Required").describe("Name of the country"),
  description: z
    .string()
    .trim()
    .nullish()
    .describe("Detailed description of the country's whisky heritage"),
  descriptionSrc: ContentSourceEnum.nullish().describe(
    "Source of the country description"
  ),
  summary: z.string().trim().nullish().describe("Brief summary of the country"),
});
