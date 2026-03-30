import { z } from "zod";
import { CASK_FILLS, CASK_SIZE_IDS, CASK_TYPE_IDS } from "../constants";
import { CaskFillEnum, CaskSizeEnum, CaskTypeEnum } from "./common";

export const BottleReleaseSchema = z.object({
  id: z.number().describe("Unique identifier for the release"),
  bottleId: z.number().describe("Reference to the parent bottle"),

  fullName: z
    .string()
    .readonly()
    .describe("Canonical release name including the brand"),
  name: z
    .string()
    .readonly()
    .describe("Canonical release name excluding the brand."),

  edition: z
    .string()
    .nullable()
    .default(null)
    .describe("Specific release label (e.g. Batch 24)"),

  statedAge: z
    .number()
    .nullable()
    .default(null)
    .describe("Official age statement for this release in years"),
  abv: z
    .number()
    .nullable()
    .default(null)
    .describe("Alcohol By Volume percentage of the spirit."),
  caskStrength: z
    .boolean()
    .nullable()
    .default(null)
    .describe(
      "Whether this spirit is bottled at Cask Strength (usually ranging from 55-65% abv). May be inferred from abv.",
    ),
  singleCask: z
    .boolean()
    .nullable()
    .default(null)
    .describe("Whether the whisky comes from a single cask"),

  vintageYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear() + 1)
    .nullable()
    .default(null)
    .describe("Year this spirit was distilled and transferred to a cask."),
  releaseYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear() + 1)
    .nullable()
    .default(null)
    .describe("Year this bottling was released."),

  caskType: CaskTypeEnum.nullable()
    .default(null)
    .describe("Type of cask used for maturation"),
  caskSize: CaskSizeEnum.nullable()
    .default(null)
    .describe("Size of the cask used for maturation"),
  caskFill: CaskFillEnum.nullable()
    .default(null)
    .describe("Fill number of the cask (1st fill, refill, etc.)"),

  description: z
    .string()
    .nullable()
    .default(null)
    .describe("Detailed description of this release"),
  tastingNotes: z
    .object({
      nose: z.string().describe("Aroma characteristics of the whisky"),
      palate: z.string().describe("Taste characteristics of the whisky"),
      finish: z.string().describe("Aftertaste characteristics of the whisky"),
    })
    .nullable()
    .default(null),
  imageUrl: z
    .string()
    .nullable()
    .default(null)
    .describe("URL to this release's image"),

  avgRating: z
    .number()
    .readonly()
    .nullable()
    .describe("Average user rating for this release"),
  totalTastings: z
    .number()
    .readonly()
    .describe("Total number of recorded tastings for this release"),

  suggestedTags: z
    .array(z.string())
    .readonly()
    .describe("System-generated tags based on this release's characteristics"),
  isFavorite: z
    .boolean()
    .readonly()
    .describe("Whether the current user has marked this bottle as a favorite"),

  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this release"),

  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when this release was created"),
  updatedAt: z
    .string()
    .datetime()
    .describe("Timestamp when this release was last updated"),
});

export const BottleReleaseInputSchema = BottleReleaseSchema.omit({
  id: true,
  fullName: true,
  bottleId: true,
  name: true,
  suggestedTags: true,
  avgRating: true,
  totalTastings: true,
  createdAt: true,
  updatedAt: true,
  isFavorite: true,
  hasTasted: true,
}).extend({
  image: z.null().optional().describe("Optional image upload for this release"),
  abv: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .default(null)
    .describe("Alcohol by volume percentage"),
});
