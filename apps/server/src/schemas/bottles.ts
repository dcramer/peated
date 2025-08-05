import { z } from "zod";
import { BottleSeriesInputSchema, BottleSeriesSchema } from "./bottleSeries";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
  ContentSourceEnum,
  FlavorProfileEnum,
} from "./common";
import { EntityInputSchema, EntitySchema } from "./entities";

export const BottleSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the bottle"),
  fullName: z
    .string()
    .readonly()
    .describe("Canonical name including the brand"),

  name: z
    .string()
    .trim()
    .describe(
      "Expression name for the bottle (e.g., Supernova for Ardbeg Supernova)",
    ),

  series: BottleSeriesSchema.nullable()
    .default(null)
    .describe(
      "Series name for this bottling (e.g. Supernova for Ardbeg Supernova)",
    ),

  category: CategoryEnum.nullable()
    .default(null)
    .describe("Category of the whisky (e.g., Scotch, Bourbon, etc.)"),

  // <deprecated>: moving to editions
  edition: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .describe("Edition name or number for this bottling"),
  statedAge: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .default(null)
    .describe("Official age statement in years"),
  caskStrength: z
    .boolean()
    .nullable()
    .default(null)
    .describe("Whether the whisky is bottled at cask strength"),
  singleCask: z
    .boolean()
    .nullable()
    .default(null)
    .describe("Whether the whisky comes from a single cask"),
  abv: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .default(null)
    .describe("Alcohol by volume percentage"),

  vintageYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null)
    .describe("Year the whisky was distilled"),
  releaseYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null)
    .describe("Year the whisky was released"),

  caskType: CaskTypeEnum.nullable()
    .default(null)
    .describe("Type of cask used for maturation"),
  caskSize: CaskSizeEnum.nullable()
    .default(null)
    .describe("Size of the cask used for maturation"),
  caskFill: CaskFillEnum.nullable()
    .default(null)
    .describe("Fill number of the cask (1st fill, refill, etc.)"),
  // </deprecated>: moving to editions

  brand: EntitySchema.describe("The brand that produces this bottle"),
  distillers: z
    .array(EntitySchema)
    .default([])
    .describe("List of distilleries that produced this whisky"),
  bottler: EntitySchema.nullable()
    .default(null)
    .describe("Independent bottler if different from the brand"),

  description: z
    .string()
    .nullable()
    .default(null)
    .describe("Detailed description of the bottle"),
  descriptionSrc: ContentSourceEnum.nullable()
    .default(null)
    .optional()
    .describe("Source of the bottle description"),
  imageUrl: z
    .string()
    .url()
    .nullable()
    .default(null)
    .readonly()
    .describe("URL to the bottle's image"),
  flavorProfile: FlavorProfileEnum.nullable()
    .default(null)
    .describe("Primary flavor characteristics of the whisky"),
  tastingNotes: z
    .object({
      nose: z.string().describe("Aroma characteristics of the whisky"),
      palate: z.string().describe("Taste characteristics of the whisky"),
      finish: z.string().describe("Aftertaste characteristics of the whisky"),
    })
    .nullish()
    .readonly(),
  suggestedTags: z
    .array(z.string())
    .optional()
    .readonly()
    .describe("System-generated tags based on the bottle's characteristics"),

  avgRating: z
    .number()
    .gte(-1)
    .lte(2)
    .nullable()
    .readonly()
    .describe(
      "Average rating from simple rating system (-1=Pass, 1=Sip, 2=Savor)",
    ),
  ratingStats: z
    .object({
      pass: z.number().describe("Number of Pass (-1) ratings"),
      sip: z.number().describe("Number of Sip (1) ratings"),
      savor: z.number().describe("Number of Savor (2) ratings"),
      total: z.number().describe("Total number of simple ratings"),
      avg: z.number().nullable().describe("Average simple rating (-1 to 2)"),
      percentage: z.object({
        pass: z.number().describe("Percentage of Pass ratings"),
        sip: z.number().describe("Percentage of Sip ratings"),
        savor: z.number().describe("Percentage of Savor ratings"),
      }),
    })
    .readonly()
    .describe("Distribution statistics for simple ratings"),
  totalTastings: z
    .number()
    .gte(0)
    .readonly()
    .describe("Total number of recorded tastings for this bottle"),
  numReleases: z
    .number()
    .gte(0)
    .readonly()
    .describe("Number of different editions of this bottle"),

  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the bottle was created"),
  updatedAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the bottle was last updated"),

  isFavorite: z
    .boolean()
    .readonly()
    .describe("Whether the current user has marked this bottle as a favorite"),
  hasTasted: z
    .boolean()
    .readonly()
    .describe("Whether the current user has recorded a tasting this bottle"),
});

const EntityChoice = z.union([
  EntityInputSchema.extend({
    id: z.number().nullish().describe("Optional ID for the entity"),
  }),
  z.number(),
]);

export const BottleInputSchema = BottleSchema.omit({
  id: true,
  fullName: true,
  suggestedTags: true,
  avgRating: true,
  ratingStats: true,
  totalTastings: true,
  createdAt: true,
  updatedAt: true,
  isFavorite: true,
  hasTasted: true,
  numReleases: true,
}).extend({
  name: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Expression name for the bottle (e.g., Supernova for Ardbeg Supernova)",
    ),
  series: z
    .union([
      z.number(),
      BottleSeriesInputSchema.omit({ brand: true }).extend({
        id: z.number().nullish().describe("Optional ID for the series"),
      }),
    ])
    .nullable()
    .default(null)
    .optional(),
  brand: EntityChoice,
  distillers: z.array(EntityChoice).default([]).optional(),
  bottler: EntityChoice.nullable().default(null).optional(),
  image: z.null().optional().describe("Optional image upload for the bottle"),
  abv: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .default(null)
    .optional()
    .describe("Alcohol by volume percentage"),
});

export const BottleMergeSchema = z.object({
  // TODO: rename to bottle
  bottleId: z.number().describe("ID of the bottle to merge"),
  direction: z
    .enum(["mergeInto", "mergeFrom"])
    .describe("Direction of the merge operation"),
});

export const BottleAliasSchema = z.object({
  bottle: z.number().describe("ID of the bottle this alias belongs to"),
  name: z.string().describe("Alternative name for the bottle"),
});
