import { z } from "zod";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
  ContentSourceEnum,
  FlavorProfileEnum,
} from "./common";
import { EntityInputSchema, EntitySchema } from "./entities";

export const BottleSchema = z.object({
  id: z.number().readonly(),
  fullName: z.string().readonly(),

  name: z.string().trim().min(1, "Required"),
  edition: z.string().trim().nullable().default(null),

  category: CategoryEnum.nullable().default(null),
  statedAge: z.number().min(0).max(100).nullable().default(null),
  caskStrength: z.boolean().nullable().default(null),
  singleCask: z.boolean().nullable().default(null),
  abv: z.number().min(0).max(100).nullable().default(null),

  vintageYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  releaseYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),

  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),

  brand: EntitySchema,
  distillers: z.array(EntitySchema).default([]),
  bottler: EntitySchema.nullable().default(null),

  description: z.string().nullable().default(null),
  descriptionSrc: ContentSourceEnum.nullable().default(null).optional(),
  imageUrl: z.string().url().nullable().default(null).readonly(),
  flavorProfile: FlavorProfileEnum.nullable().default(null),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullish()
    .readonly(),
  suggestedTags: z.array(z.string()).optional().readonly(),

  avgRating: z.number().gte(0).lte(5).nullable().readonly(),
  totalTastings: z.number().gte(0).readonly(),
  numEditions: z.number().gte(0).readonly(),

  createdAt: z.string().datetime().readonly(),
  updatedAt: z.string().datetime().readonly(),

  isFavorite: z.boolean().readonly(),
  hasTasted: z.boolean().readonly(),
});

const EntityChoice = z.union([
  EntityInputSchema.extend({
    id: z.number().nullish(),
  }),
  z.number(),
]);

export const BottleInputSchema = BottleSchema.omit({
  id: true,
  fullName: true,
  suggestedTags: true,
  avgRating: true,
  totalTastings: true,
  createdAt: true,
  updatedAt: true,
  isFavorite: true,
  hasTasted: true,
}).extend({
  brand: EntityChoice,
  distillers: z.array(EntityChoice).default([]).optional(),
  bottler: EntityChoice.nullable().default(null).optional(),
  image: z.null().optional(),
  abv: z.number().min(0).max(100).nullable().default(null).optional(),
});

export const BottleMergeSchema = z.object({
  // TODO: rename to bottle
  bottleId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});

export const BottleAliasSchema = z.object({
  bottle: z.number(),
  name: z.string(),
});
