import { z } from "zod";
import { BottleReleaseSchema } from "./bottleReleases";
import { BottleSchema } from "./bottles";
import { UserSchema } from "./users";

export const CollectionSchema = z.object({
  id: z.number().describe("Unique identifier for the collection"),
  name: z.string().trim().min(1, "Required").describe("Name of the collection"),
  totalBottles: z
    .number()
    .describe("Total number of bottles in this collection"),
  createdAt: z
    .string()
    .datetime()
    .optional()
    .describe("Timestamp when the collection was created"),
  createdBy: UserSchema.optional().describe("User who created this collection"),
});

export const CollectionInputSchema = z.object({
  name: z.string().trim().min(1, "Required").describe("Name of the collection"),
});

export const CollectionBottleStatusSchema = z.enum(["sealed", "open", "empty"]);

export const CollectionBottleSchema = z.object({
  id: z.number().describe("Unique identifier for the collection bottle entry"),
  imageUrl: z
    .string()
    .nullable()
    .default(null)
    .readonly()
    .describe("URL to the collection entry's image"),
  status: CollectionBottleStatusSchema.nullable()
    .default(null)
    .describe("Bottle status for Library entries"),
  bottle: BottleSchema.describe("The bottle in this collection"),
  release: BottleReleaseSchema.nullish().describe(
    "Specific release of the bottle, if applicable",
  ),
});

export const CollectionBottleInputSchema = z.object({
  bottle: z.number().describe("ID of the bottle to add to the collection"),
  release: z
    .number()
    .nullish()
    .describe("ID of the specific release, if applicable"),
  status: CollectionBottleStatusSchema.nullish().describe(
    "Optional bottle status for Library entries",
  ),
});
