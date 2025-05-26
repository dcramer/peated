import { z } from "zod";
import { EntitySchema } from "./entities";

export const BottleSeriesSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the bottle series"),
  name: z
    .string()
    .trim()
    .describe("Name of the series (e.g., Supernova, 18-year-old)"),
  brand: EntitySchema.describe("The brand that produces this series"),
  fullName: z
    .string()
    .describe("Full name of the series (brand name + series name)")
    .readonly(),
  description: z
    .string()
    .nullable()
    .default(null)
    .describe("Detailed description of the series"),
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

export const BottleSeriesInputSchema = BottleSeriesSchema.omit({
  id: true,
  fullName: true,
  brand: true,
  numReleases: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  brand: z.number().describe("ID of the brand that produces this series"),
});
