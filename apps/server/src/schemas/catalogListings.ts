import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { z } from "zod";

const CatalogListingUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "URL must use HTTP or HTTPS.",
  });

export const CatalogListingInputSchema = z
  .object({
    externalProductId: z.string().trim().min(1).max(255).optional(),
    name: z.string().trim().min(1).max(500),
    url: CatalogListingUrlSchema,
    imageUrl: CatalogListingUrlSchema.nullable().optional(),
    volume: z.number().int().positive().nullable().optional(),
    sourceBottleIdentity: BottleExtractedDetailsSchema.optional(),
  })
  .strict();

export const CatalogListingSchema = z
  .object({
    externalProductId: z.string().nullable(),
    name: z.string(),
    url: CatalogListingUrlSchema,
    imageUrl: CatalogListingUrlSchema.nullable(),
    volume: z.number().int().positive().nullable(),
    sourceBottleIdentity: BottleExtractedDetailsSchema.nullable(),
    firstSeenAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const CatalogListingCoverageSchema = z
  .object({
    total: z.number().int().nonnegative(),
    withProductId: z.number().int().nonnegative(),
    withImage: z.number().int().nonnegative(),
    withVolume: z.number().int().nonnegative(),
    withBottleDetails: z.number().int().nonnegative(),
  })
  .strict();

export type CatalogListingInput = z.input<typeof CatalogListingInputSchema>;
export type ParsedCatalogListingInput = z.output<
  typeof CatalogListingInputSchema
>;
