import { z } from "zod";
import { CATEGORY_LIST } from "../constants";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  ContentSourceEnum,
  FlavorProfileEnum,
} from "./common";
import { EntityInputSchema, EntitySchema } from "./entities";
import { UserSchema } from "./users";

export const CategoryEnum = z.enum(CATEGORY_LIST);

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

  statedAge: z.number().nullable(),
  vintageYear: z.number().gte(1800).lte(new Date().getFullYear()).nullable(),
  caskType: CaskTypeEnum.nullable(),
  caskSize: CaskSizeEnum.nullable(),
  caskFill: CaskFillEnum.nullable(),
  releaseDate: z.string().date().nullable(),

  brand: EntitySchema,
  distillers: z.array(EntitySchema),
  bottler: EntitySchema.nullable(),

  avgRating: z.number().gte(0).lte(5).nullable(),
  totalTastings: z.number().gte(0),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  createdBy: UserSchema.optional(),

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

  statedAge: z.number().nullish(),
  vintageYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),
  caskType: CaskTypeEnum.nullish(),
  caskSize: CaskSizeEnum.nullish(),
  caskFill: CaskFillEnum.nullish(),
  releaseDate: z.string().date().nullish(),

  description: z.string().nullish(),
  descriptionSrc: ContentSourceEnum.nullish(),
});

export const BottleMergeSchema = z.object({
  bottleId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});
