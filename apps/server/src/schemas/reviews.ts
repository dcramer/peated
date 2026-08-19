import { z } from "zod";
import { BottleSchema } from "./bottles";
import { CategoryEnum } from "./common";
import { ExternalSiteSchema, ExternalSiteTypeEnum } from "./externalSites";

export const NativeScoreSchema = z
  .object({
    value: z.number().finite().nonnegative(),
    scale: z.number().finite().positive(),
    display: z.string().trim().min(1).max(50),
  })
  .strict()
  .refine(({ value, scale }) => value <= scale, {
    message: "Native score value cannot exceed its scale.",
    path: ["value"],
  });

export const ReviewSchema = z.object({
  id: z.number().describe("Unique identifier for the review"),
  name: z.string().describe("Name of the reviewed product"),
  rating: z
    .number()
    .nullable()
    .describe("Normalized rating given in the review, when available"),
  url: z.string().describe("URL to the original review"),
  site: ExternalSiteSchema.optional().describe(
    "External site where the review was published",
  ),
  article: z.object({
    title: z.string().nullable(),
    publishedAt: z.string().datetime().nullable(),
  }),
  reviewerName: z.string().nullable(),
  nativeScore: NativeScoreSchema.nullable(),
  summary: z.string().nullable(),
  bottle: BottleSchema.nullable().describe(
    "Bottle associated with the review, or null when unresolved",
  ),
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
  rating: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Normalized rating given in the review"),
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
