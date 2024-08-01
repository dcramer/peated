import { z } from "zod";
import { BadgeAwardSchema } from "./badges";
import { BottleSchema } from "./bottles";
import { ServingStyleEnum, zDatetime, zTag } from "./common";
import { UserSchema } from "./users";

export const TastingSchema = z.object({
  id: z.number(),
  imageUrl: z.string().nullable(),
  notes: z.string().nullable(),
  bottle: BottleSchema,
  rating: z.number().gte(0).lte(5).nullable(),
  tags: z.array(z.string()),
  color: z.number().gte(0).lte(20).nullable(),
  servingStyle: ServingStyleEnum.nullable(),
  friends: z.array(UserSchema),

  awards: z.array(BadgeAwardSchema),

  comments: z.number().gte(0),
  toasts: z.number().gte(0),
  hasToasted: z.boolean().optional(),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
});

export const TastingInputSchema = z.object({
  bottle: z.number(),
  notes: z.string().nullish(),
  rating: z.number().gte(0).lte(5).nullish(),
  tags: z.array(zTag).max(15).nullish(),
  color: z.number().gte(0).lte(20).nullish(),

  servingStyle: ServingStyleEnum.nullish(),
  friends: z.array(z.number()).optional(),
  flight: z.string().nullish(),

  createdAt: zDatetime.optional(),
});

export const TastingUpdateSchema = z.object({
  notes: z.string().nullish(),
  rating: z.number().gte(0).lte(5).nullish(),
  tags: z.array(zTag).max(15).nullish(),
  color: z.number().gte(0).lte(20).nullish(),
  servingStyle: ServingStyleEnum.nullish(),
  friends: z.array(z.number()).optional(),
  flight: z.string().nullish(),
});
