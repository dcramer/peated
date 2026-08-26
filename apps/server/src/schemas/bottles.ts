import { releaseYearFromDate } from "@peated/server/lib/bottleRelease";
import { isCanonicalPeatedId } from "@peated/server/lib/peatedId";
import { z } from "zod";
import { BottleSeriesInputSchema, BottleSeriesSchema } from "./bottleSeries";
import { BottleGroupV1Schema } from "./catalogIdentity";
import { CategoryEnum, ContentSourceEnum, FlavorProfileEnum } from "./common";
import { EntityInputSchema, EntitySchema } from "./entities";

const BottleNameSchema = z
  .string()
  .trim()
  .describe("Marketed Bottle name excluding the brand");
const BottleSeriesSchemaField = BottleSeriesSchema.nullable()
  .default(null)
  .describe("Series or family name for this bottle");
const BottleCategorySchema = CategoryEnum.nullable()
  .default(null)
  .describe("Category of the whisky (e.g., Scotch, Bourbon, etc.)");
const BottleEditionSchema = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .describe("Optional edition label for this Bottle");
const BottleStatedAgeSchema = z
  .number()
  .min(0)
  .max(100)
  .nullable()
  .default(null)
  .describe("Effective stated age for this exact Bottle, in years");
const BottleNoAgeStatementSchema = z
  .boolean()
  .nullable()
  .default(null)
  .describe("Whether the label was confirmed to have no age statement");
const BottleCaskStrengthSchema = z
  .boolean()
  .nullable()
  .default(null)
  .describe("Whether the whisky is bottled at cask strength");
const BottleSingleCaskSchema = z
  .boolean()
  .nullable()
  .default(null)
  .describe("Whether the whisky comes from a single cask");
const BottleNaturalColorSchema = z
  .boolean()
  .nullable()
  .default(null)
  .describe("Whether the whisky has no added coloring");
const BottleNonChillFilteredSchema = z
  .boolean()
  .nullable()
  .default(null)
  .describe("Whether the whisky was bottled without chill filtration");
const BottleMaltPhenolPpmSchema = z
  .number()
  .min(0)
  .nullable()
  .default(null)
  .describe(
    "Producer-stated phenol level of the malted barley, in parts per million",
  );
const BottleAbvSchema = z
  .number()
  .min(0)
  .max(100)
  .nullable()
  .default(null)
  .describe("Alcohol by volume percentage");
const BottleVintageYearSchema = z
  .number()
  .gte(1800)
  .lte(new Date().getFullYear())
  .nullable()
  .default(null)
  .describe("Year this whisky was distilled");
const BottleBottlingYearSchema = z
  .number()
  .gte(1800)
  .lte(new Date().getFullYear())
  .nullable()
  .default(null)
  .describe("Year this whisky was bottled");
const BottleReleaseYearSchema = z
  .number()
  .gte(1800)
  .lte(new Date().getFullYear())
  .nullable()
  .default(null)
  .describe("Year this release became available");
const BottleReleaseDateSchema = z
  .string()
  .date()
  .refine(
    (value) => {
      const year = releaseYearFromDate(value);
      return year >= 1800 && year <= new Date().getFullYear();
    },
    { message: "Release date year must be between 1800 and the current year" },
  )
  .nullable()
  .default(null)
  .describe("Exact date this release became available, when known");
const BottleMaturationSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .nullable()
  .default(null)
  .describe("Producer-stated cask or maturation details");
const BottleCaskNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .default(null)
  .describe("Marketed cask or barrel identifier");
const BottleOutturnSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .default(null)
  .describe("Producer-stated total number of bottles in the release");
const BottleDescriptionSchema = z
  .string()
  .nullable()
  .default(null)
  .describe("Detailed description of the bottle");
const BottleDescriptionSourceSchema = ContentSourceEnum.nullable()
  .default(null)
  .optional()
  .describe("Source of the bottle description");
const BottleImageUrlSchema = z
  .string()
  .url()
  .nullable()
  .default(null)
  .readonly()
  .describe("URL to the bottle's image");
const BottleFlavorProfileSchema = FlavorProfileEnum.nullable()
  .default(null)
  .describe("Primary flavor characteristics of the whisky");
const BottleTastingNotesSchema = z
  .object({
    nose: z.string().describe("Aroma characteristics of the whisky"),
    palate: z.string().describe("Taste characteristics of the whisky"),
    finish: z.string().describe("Aftertaste characteristics of the whisky"),
  })
  .nullish()
  .readonly();

export const BottleSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the bottle"),
  peatedId: z
    .string()
    .regex(/^B\d{4,}$/)
    .refine((value) => isCanonicalPeatedId(value, "bottle"))
    .readonly()
    .describe("Permanent Peated ID for the bottle"),
  fullName: z
    .string()
    .readonly()
    .describe("Canonical marketed Bottle name including the brand"),

  name: BottleNameSchema,

  group: BottleGroupV1Schema.optional().describe(
    "Shared editing and aggregate context for this independently complete Bottle",
  ),

  series: BottleSeriesSchemaField,

  category: BottleCategorySchema,

  edition: BottleEditionSchema,
  statedAge: BottleStatedAgeSchema,
  noAgeStatement: BottleNoAgeStatementSchema,
  caskStrength: BottleCaskStrengthSchema,
  singleCask: BottleSingleCaskSchema,
  naturalColor: BottleNaturalColorSchema,
  nonChillFiltered: BottleNonChillFilteredSchema,
  maltPhenolPpm: BottleMaltPhenolPpmSchema,
  abv: BottleAbvSchema,

  vintageYear: BottleVintageYearSchema,
  bottlingYear: BottleBottlingYearSchema,
  releaseYear: BottleReleaseYearSchema,
  releaseDate: BottleReleaseDateSchema,

  maturation: BottleMaturationSchema,
  caskNumber: BottleCaskNumberSchema,
  outturn: BottleOutturnSchema,

  brand: EntitySchema.describe("The brand that produces this bottle"),
  distillers: z
    .array(EntitySchema)
    .default([])
    .describe("List of distilleries that produced this whisky"),
  bottler: EntitySchema.nullable()
    .default(null)
    .describe("Evidenced bottling company, which may also be the brand"),

  description: BottleDescriptionSchema,
  descriptionSrc: BottleDescriptionSourceSchema,
  imageUrl: BottleImageUrlSchema,
  flavorProfile: BottleFlavorProfileSchema,
  tastingNotes: BottleTastingNotesSchema,
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
  avgScore: z
    .number()
    .gte(0)
    .lte(100)
    .nullable()
    .readonly()
    .describe("Average 100-point community score for this exact bottle"),
  totalScores: z
    .number()
    .gte(0)
    .readonly()
    .describe("Number of 100-point community scores for this exact bottle"),
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
  isLibrary: z
    .boolean()
    .readonly()
    .describe(
      "Whether the current user has saved this bottle to their library",
    ),
  hasTasted: z
    .boolean()
    .readonly()
    .describe("Whether the current user has recorded a tasting this bottle"),
});

export const EntityChoiceInputSchema = EntityInputSchema.extend({
  id: z.number().nullish().describe("Optional ID for the entity"),
});
export const EntityChoiceSchema = z.union([
  EntityChoiceInputSchema,
  z.number(),
]);
const BrandChoice = z
  .union([EntityChoiceSchema, z.null(), z.undefined()])
  .refine(
    (value): value is z.infer<typeof EntityChoiceSchema> =>
      value !== null && value !== undefined,
    { message: "Brand is required." },
  );
const BottleInputSeriesSchema = z
  .union([
    z.number(),
    BottleSeriesInputSchema.omit({ brand: true }).extend({
      id: z.number().nullish().describe("Optional ID for the series"),
    }),
  ])
  .nullable()
  .default(null)
  .optional();
const BottleInputAbvSchema = z
  .number()
  .min(0)
  .max(100)
  .nullable()
  .default(null)
  .optional()
  .describe("Alcohol by volume percentage");

export const BottleInputFields = {
  name: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Expression name for the bottle (e.g., Supernova for Ardbeg Supernova)",
    ),
  series: BottleInputSeriesSchema,
  category: BottleCategorySchema,
  edition: BottleEditionSchema,
  statedAge: BottleStatedAgeSchema,
  noAgeStatement: BottleNoAgeStatementSchema,
  caskStrength: BottleCaskStrengthSchema,
  singleCask: BottleSingleCaskSchema,
  naturalColor: BottleNaturalColorSchema,
  nonChillFiltered: BottleNonChillFilteredSchema,
  maltPhenolPpm: BottleMaltPhenolPpmSchema,
  abv: BottleInputAbvSchema,
  vintageYear: BottleVintageYearSchema,
  bottlingYear: BottleBottlingYearSchema,
  releaseYear: BottleReleaseYearSchema,
  releaseDate: BottleReleaseDateSchema,
  maturation: BottleMaturationSchema,
  caskNumber: BottleCaskNumberSchema,
  outturn: BottleOutturnSchema,
  brand: BrandChoice,
  distillers: z.array(EntityChoiceSchema).default([]).optional(),
  bottler: EntityChoiceSchema.nullable().default(null).optional(),
  description: BottleDescriptionSchema,
  descriptionSrc: BottleDescriptionSourceSchema,
  imageUrl: BottleImageUrlSchema,
  flavorProfile: BottleFlavorProfileSchema,
  tastingNotes: BottleTastingNotesSchema,
  image: z.null().optional().describe("Optional image upload for the bottle"),
} as const;

export const BottleInputSchema = z.object(BottleInputFields);

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
