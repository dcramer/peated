import { z } from "zod";
import { CATEGORY_LIST } from "../constants";
import { FlavorProfileEnum } from "./common";
import { EntityInputSchema, EntitySchema } from "./entities";
import { UserSchema } from "./users";

export const CategoryEnum = z.enum(CATEGORY_LIST);

export const BottleSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  fullName: z.string(),
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
  brand: EntitySchema,
  distillers: z.array(EntitySchema),
  bottler: EntitySchema.nullable(),
  statedAge: z.number().nullable(),
  category: CategoryEnum.nullable(),

  avgRating: z.number().gte(0).lte(5).nullable(),
  totalTastings: z.number().gte(0),

  createdAt: z.string().datetime().optional(),
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
  brand: EntityChoice,
  flavorProfile: FlavorProfileEnum.nullish(),
  distillers: z.array(EntityChoice).optional(),
  bottler: EntityChoice.nullish(),
  statedAge: z.number().gte(0).lte(100).nullish(),
  category: CategoryEnum.nullish(),
  description: z.string().nullable().optional(),
});

export const BottleMergeSchema = z.object({
  bottleId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});
