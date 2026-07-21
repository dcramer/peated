import { z } from "zod";
import { CatalogTargetV1Schema } from "./catalogIdentity";
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
  target: CatalogTargetV1Schema.describe(
    "Exact Bottle or generic BottleGroup referenced by this collection entry",
  ),
  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this CatalogTarget"),
});

const collectionBottleStatusInputShape = {
  status: CollectionBottleStatusSchema.nullish().describe(
    "Optional bottle status for Library entries",
  ),
};

export const CollectionBottleTargetInputSchema = z
  .object({
    target: z
      .number()
      .int()
      .positive()
      .describe("Authoritative CatalogTarget for this collection action"),
    ...collectionBottleStatusInputShape,
  })
  .strict();

export const CollectionBottleLegacyInputSchema = z
  .object({
    bottle: z.number().describe("Retained Bottle compatibility input"),
    release: z
      .number()
      .nullish()
      .describe("Retained BottleRelease compatibility input"),
    ...collectionBottleStatusInputShape,
  })
  .strict();
