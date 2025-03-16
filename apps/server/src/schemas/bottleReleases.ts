import { z } from "zod";
import { CASK_FILLS, CASK_SIZE_IDS, CASK_TYPE_IDS } from "../constants";

export const BottleReleaseSchema = z.object({
  id: z.number().describe("Unique identifier for the bottle edition"),
  bottleId: z.number().describe("Reference to the parent bottle"),

  fullName: z.string().describe("Canonical name including the brand"),
  name: z.string().describe("Canonical name excluding the brand."),

  series: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "Series name for this bottling (e.g. Supernova for Ardbeg Supernova)",
    ),

  edition: z
    .string()
    .nullable()
    .default(null)
    .describe("Specific edition identifier (e.g. Batch #1)"),

  statedAge: z.number().nullable().describe("Official age statement in years"),
  abv: z
    .number()
    .nullable()
    .describe("Alcohol By Volume percentage of the spirit."),
  caskStrength: z
    .boolean()
    .nullable()
    .describe(
      "Whether this spirit is bottled at Cask Strength (usually ranging from 55-65% abv). May be inferred from abv.",
    ),
  singleCask: z
    .boolean()
    .nullable()
    .describe("Whether the whisky comes from a single cask"),

  vintageYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear() + 1)
    .nullable()
    .describe("Year this spirit was distilled and transferred to a cask."),
  releaseYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear() + 1)

    .nullable()
    .describe("Year this bottling was released."),

  caskType: z
    .enum(CASK_TYPE_IDS)
    .nullable()
    .describe("Type of cask used for maturation."),
  caskFill: z
    .enum(CASK_FILLS)
    .nullable()
    .describe("Fill number of the cask (1st fill, refill, etc.)"),
  caskSize: z
    .enum(CASK_SIZE_IDS)
    .nullable()
    .describe("Size of the cask used for maturation"),

  description: z
    .string()
    .nullable()
    .describe("Detailed description of the bottle edition"),
  tastingNotes: z
    .object({
      nose: z.string().describe("Aroma characteristics of the whisky"),
      palate: z.string().describe("Taste characteristics of the whisky"),
      finish: z.string().describe("Aftertaste characteristics of the whisky"),
    })
    .nullable(),
  imageUrl: z.string().nullable().describe("URL to the bottle edition's image"),

  avgRating: z
    .number()
    .nullable()
    .describe("Average user rating for this edition"),
  totalTastings: z
    .number()
    .describe("Total number of recorded tastings for this edition"),

  suggestedTags: z
    .array(z.string())
    .describe("System-generated tags based on the edition's characteristics"),
  isFavorite: z
    .boolean()
    .readonly()
    .describe("Whether the current user has marked this bottle as a favorite"),

  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this edition"),

  createdAt: z.string().describe("Timestamp when the edition was created"),
  updatedAt: z.string().describe("Timestamp when the edition was last updated"),
});

export const BottleReleaseInputSchema = BottleReleaseSchema.omit({
  id: true,
  fullName: true,
  name: true,
  suggestedTags: true,
  avgRating: true,
  totalTastings: true,
  createdAt: true,
  updatedAt: true,
  isFavorite: true,
  hasTasted: true,
}).extend({
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
