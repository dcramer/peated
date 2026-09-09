import { isCanonicalPeatedId } from "@peated/server/lib/peatedId";
import { z } from "zod";
import { EntitySchema } from "./entities";

const BottleSeriesNameSchema = z
  .string()
  .trim()
  .describe("Name of the series (e.g., Supernova, 18-year-old)");
const BottleSeriesDescriptionSchema = z
  .string()
  .nullable()
  .default(null)
  .describe("Detailed description of the series");

export const BottleSeriesSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the bottle series"),
  peatedId: z
    .string()
    .regex(/^S\d{4,}$/)
    .refine((value) => isCanonicalPeatedId(value, "series"))
    .readonly()
    .describe("Permanent Peated ID for the bottle series"),
  name: BottleSeriesNameSchema,
  fullName: z
    .string()
    .describe("Full name of the series (brand name + series name)")
    .readonly(),
  description: BottleSeriesDescriptionSchema,
  numReleases: z
    .number()
    .default(0)
    .readonly()
    .describe("Number of releases in this series"),
  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the series was created"),
  updatedAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the series was last updated"),
});

export const BottleSeriesWithImageSchema = BottleSeriesSchema.extend({
  representativeBottleId: z
    .number()
    .int()
    .positive()
    .nullable()
    .readonly()
    .describe("Bottle whose primary image illustrates this series"),
  imageUrl: z
    .string()
    .url()
    .nullable()
    .readonly()
    .describe("Current primary image URL of the representative bottle"),
});

const BottleSeriesBrandSchema = EntitySchema.pick({
  id: true,
  peatedId: true,
  name: true,
  shortName: true,
  kind: true,
});

export const BottleSeriesListItemSchema = BottleSeriesWithImageSchema.extend({
  brand: BottleSeriesBrandSchema.describe("Brand that owns this bottle series"),
  numBottles: z
    .number()
    .int()
    .nonnegative()
    .readonly()
    .describe("Number of active bottles matching the list filters"),
});

export const BottleSeriesDetailsSchema = BottleSeriesWithImageSchema.extend({
  brand: BottleSeriesBrandSchema.describe("Brand that owns this bottle series"),
  distillers: z
    .array(
      EntitySchema.pick({
        id: true,
        peatedId: true,
        name: true,
        shortName: true,
        kind: true,
      }).extend({
        numBottles: z
          .number()
          .readonly()
          .describe("Number of active Series Bottles from this Distillery"),
      }),
    )
    .readonly()
    .describe("Distilleries represented by active Bottles in this Series"),
});

export const BottleSeriesInputFields = {
  name: BottleSeriesNameSchema,
  description: BottleSeriesDescriptionSchema,
  brand: z.number().describe("ID of the brand that produces this series"),
} as const;

export const BottleSeriesInputSchema = z.object(BottleSeriesInputFields);
