import { z } from "zod";
import { BottleSchema } from "./bottles";
import { CategoryEnum } from "./common";
import { ExternalSiteSchema, ExternalSiteTypeEnum } from "./externalSites";

export const ReviewSchema = z.object({
  id: z.number().describe("Unique identifier for the review"),
  name: z.string().describe("Name of the reviewed product"),
  rating: z.number().describe("Rating given in the review"),
  url: z.string().describe("URL to the original review"),
  site: ExternalSiteSchema.optional().describe(
    "External site where the review was published",
  ),
  bottle: BottleSchema.nullish()
    .default(null)
    .describe("Bottle this review is associated with"),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the review was created"),
  updatedAt: z
    .string()
    .datetime()
    .describe("Timestamp when the review was last updated"),
});

export const ReviewInputSchema = z.object({
  site: ExternalSiteTypeEnum.describe("Type of external site"),
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Name of the reviewed product"),
  category: CategoryEnum.nullable()
    .default(null)
    .describe("Category of the whisky being reviewed"),
  rating: z.number().describe("Rating given in the review"),
  issue: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Issue or problem with the review"),
  url: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("URL to the original review"),
});
