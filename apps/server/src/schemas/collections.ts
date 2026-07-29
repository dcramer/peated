import { z } from "zod";
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
  bottle: BottleSchema.describe("Bottle referenced by this collection entry"),
  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this Bottle"),
});

const collectionBottleStatusInputShape = {
  status: CollectionBottleStatusSchema.nullish().describe(
    "Optional bottle status for Library entries",
  ),
};

export const CollectionBottleInputSchema = z
  .object({
    bottle: z
      .number()
      .int()
      .positive()
      .describe("Bottle selected for this collection action"),
    ...collectionBottleStatusInputShape,
  })
  .strict();
