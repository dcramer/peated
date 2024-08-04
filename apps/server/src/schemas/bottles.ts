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

  category: CategoryEnum.nullable().default(null),
  statedAge: z.number().min(0).max(100).nullable().default(null),

  caskStrength: z.boolean().nullable().default(null),
  singleCask: z.boolean().nullable().default(null),

  brand: EntitySchema,
  distillers: z.array(EntitySchema).default([]),
  bottler: EntitySchema.nullable().default(null),

  avgRating: z.number().gte(0).lte(5).nullable(),
  totalTastings: z.number().gte(0),

  flavorProfile: FlavorProfileEnum.nullable().default(null),
  description: z.string().nullish(),
  descriptionSrc: ContentSourceEnum.nullish(),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable()
    .optional(),
  suggestedTags: z.array(z.string()).optional().readonly(),

  createdAt: z.string().datetime().readonly(),
  updatedAt: z.string().datetime().readonly(),

  createdBy: UserSchema.nullish().readonly(),

  isFavorite: z.boolean().optional().readonly(),
  hasTasted: z.boolean().optional().readonly(),
});

export const BottleEditionSchema = z.object({
  id: z.number(),
  bottle: BottleSchema.optional(),

  name: z.string().trim().min(1, "Required"),
  editionName: z.string().trim().nullable().default(null),
  fullName: z.string().readonly(),

  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),

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
  bottleYear: z
    .number()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),

  avgRating: z.number().gte(0).lte(5).nullable().readonly(),
  totalTastings: z.number().gte(0).readonly(),

  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable()
    .optional(),
  suggestedTags: z.array(z.string()).optional().readonly(),

  createdAt: z.string().datetime().readonly(),
  updatedAt: z.string().datetime().readonly(),

  createdBy: UserSchema.nullish().readonly(),

  isFavorite: z.boolean().optional().readonly(),
  hasTasted: z.boolean().optional().readonly(),
});

const EntityChoice = z.union([
  EntityInputSchema.extend({
    id: z.number().nullish(),
  }),
  z.number(),
]);

// export const BottleInputSchema = z.object({
//   name: z.string().trim().min(1, "Required"),
//   category: CategoryEnum.nullish(),

//   brand: EntityChoice,
//   flavorProfile: FlavorProfileEnum.nullish(),
//   distillers: z.array(EntityChoice).nullish(),
//   bottler: EntityChoice.nullish(),

//   statedAge: z.number().min(0).max(100).nullish(),
//   vintageYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),
//   caskType: CaskTypeEnum.nullish(),
//   caskSize: CaskSizeEnum.nullish(),
//   caskFill: CaskFillEnum.nullish(),
//   releaseYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),

//   description: z.string().nullish(),
//   descriptionSrc: ContentSourceEnum.nullish(),
// });

export const BottleInputSchema = BottleSchema.merge(BottleEditionSchema).extend(
  {
    brand: EntityChoice,
    distillers: z.array(EntityChoice).nullish().default(null),
    bottler: EntityChoice.nullish().default(null),
  },
);

//  z.object({
//   name: z.string().trim().min(1, "Required"),
//   category: CategoryEnum.nullish(),

//   brand: EntityChoice,
//   flavorProfile: FlavorProfileEnum.nullish(),
//   distillers: z.array(EntityChoice).nullish(),
//   bottler: EntityChoice.nullish(),

//   statedAge: z.number().min(0).max(100).nullish(),
//   vintageYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),
//   caskType: CaskTypeEnum.nullish(),
//   caskSize: CaskSizeEnum.nullish(),
//   caskFill: CaskFillEnum.nullish(),
//   releaseYear: z.number().gte(1800).lte(new Date().getFullYear()).nullish(),

//   description: z.string().nullish(),
//   descriptionSrc: ContentSourceEnum.nullish(),
// });

export const BottleMergeSchema = z.object({
  // TODO: rename to bottle
  bottleId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});

export const BottleAliasSchema = z.object({
  bottle: z.number(),
  name: z.string(),
});
