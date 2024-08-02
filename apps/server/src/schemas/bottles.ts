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
import { UserSchema } from "./users";

export const BottleSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  fullName: z.string(),

  category: CategoryEnum.nullable(),
  description: z.string().nullable().optional(),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable()
    .optional(),
  suggestedTags: z.array(z.string()).optional(),
  flavorProfile: FlavorProfileEnum.nullable(),

  statedAge: z.number().min(0).max(100).nullish(),
  vintageYear: z.number().gte(1800).lte(new Date().getFullYear()).nullable(),
  caskType: CaskTypeEnum.nullable(),
  caskSize: CaskSizeEnum.nullable(),
  caskFill: CaskFillEnum.nullable(),
  releaseYear: z.number().gte(1800).lte(new Date().getFullYear()).nullable(),

  brand: EntitySchema,
  distillers: z.array(EntitySchema),
  bottler: EntitySchema.nullable(),

  avgRating: z.number().gte(0).lte(5).nullable(),
  totalTastings: z.number().gte(0),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  createdBy: UserSchema.nullish(),

  isFavorite: z.boolean().optional(),
  hasTasted: z.boolean().optional(),
});

const EntityChoice = z.union([
  EntityInputSchema.extend({
    id: z.number().nullish(),
  }),
  z.number(),
]);

export const BottleInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  category: CategoryEnum.nullish(),

  brand: EntityChoice,
  flavorProfile: FlavorProfileEnum.nullish(),
  distillers: z.array(EntityChoice).nullish(),
  bottler: EntityChoice.nullish(),

  statedAge: z.number().min(0).max(100).nullish(),
  vintageYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),
  caskType: CaskTypeEnum.nullish(),
  caskSize: CaskSizeEnum.nullish(),
  caskFill: CaskFillEnum.nullish(),
  releaseYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),

  description: z.string().nullish(),
  descriptionSrc: ContentSourceEnum.nullish(),
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
