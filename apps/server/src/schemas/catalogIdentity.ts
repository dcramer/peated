import { z } from "zod";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
  ContentSourceEnum,
  FlavorProfileEnum,
} from "./common";

export const CATALOG_IDENTITY_SCHEMA_VERSION = 1 as const;

const CatalogIdentitySchemaVersion = z
  .literal(CATALOG_IDENTITY_SCHEMA_VERSION)
  .describe("Version of the catalog identity result contract");

const RatingStatsSchema = z.object({
  pass: z.number().int().gte(0),
  sip: z.number().int().gte(0),
  savor: z.number().int().gte(0),
  total: z.number().int().gte(0),
  avg: z.number().nullable(),
  percentage: z.object({
    pass: z.number().gte(0),
    sip: z.number().gte(0),
    savor: z.number().gte(0),
  }),
});

const TastingNotesSchema = z.object({
  nose: z.string(),
  palate: z.string(),
  finish: z.string(),
});

/** Runtime-owned v1 result for the stable expression shared by Bottles. */
export const BottleGroupV1Schema = z.object({
  schemaVersion: CatalogIdentitySchemaVersion,
  id: z.number().int().positive(),
  fullName: z.string().min(1),
  name: z.string().min(1),
  brandId: z.number().int().positive(),
  bottlerId: z.number().int().positive().nullable(),
  distillerIds: z.array(z.number().int().positive()),
  category: CategoryEnum.nullable(),
  seriesId: z.number().int().positive().nullable(),
  statedAge: z.number().int().min(0).max(100).nullable(),
  representativeBottleId: z.number().int().positive().nullable(),
  flavorProfile: FlavorProfileEnum.nullable(),
  avgRating: z.number().nullable(),
  ratingStats: RatingStatsSchema,
  totalTastings: z.number().int().gte(0),
  totalBottles: z.number().int().gte(1),
  createdByActorId: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Runtime-owned v1 result for one complete Bottle. */
export const BottleV1Schema = z.object({
  schemaVersion: CatalogIdentitySchemaVersion,
  id: z.number().int().positive(),
  groupId: z.number().int().positive(),
  fullName: z.string().min(1),
  name: z.string().min(1),
  brandId: z.number().int().positive(),
  bottlerId: z.number().int().positive().nullable(),
  distillerIds: z.array(z.number().int().positive()),
  category: CategoryEnum.nullable(),
  seriesId: z.number().int().positive().nullable(),
  flavorProfile: FlavorProfileEnum.nullable(),
  edition: z.string().nullable(),
  statedAge: z.number().int().min(0).max(100).nullable(),
  abv: z.number().min(0).max(100).nullable(),
  singleCask: z.boolean().nullable(),
  caskStrength: z.boolean().nullable(),
  vintageYear: z.number().int().gte(1800).nullable(),
  releaseYear: z.number().int().gte(1800).nullable(),
  caskSize: CaskSizeEnum.nullable(),
  caskType: CaskTypeEnum.nullable(),
  caskFill: CaskFillEnum.nullable(),
  description: z.string().nullable(),
  descriptionSrc: ContentSourceEnum.nullable(),
  imageUrl: z.string().url().nullable(),
  tastingNotes: TastingNotesSchema.nullable(),
  suggestedTags: z.array(z.string()),
  avgRating: z.number().nullable(),
  ratingStats: RatingStatsSchema,
  totalTastings: z.number().int().gte(0),
  createdByActorId: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BottleGroupV1 = z.infer<typeof BottleGroupV1Schema>;
export type BottleV1 = z.infer<typeof BottleV1Schema>;
