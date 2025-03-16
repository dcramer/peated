import { z } from "zod";
import { BadgeAwardSchema } from "./badges";
import { BottleEditionSchema } from "./bottleEditions";
import { BottleSchema } from "./bottles";
import { ServingStyleEnum, zDatetime } from "./common";
import { UserSchema } from "./users";

export const TastingSchema = z.object({
  id: z.number(),
  imageUrl: z.string().nullable().default(null).readonly(),
  notes: z.string().nullable().default(null),
  bottle: BottleSchema,
  edition: BottleEditionSchema.describe(
    "The edition of the bottle, if applicable. e.g. 'Ardbeg Supernova 2023'",
  ),
  rating: z.number().gte(0).lte(5).nullable().default(null),
  tags: z.array(z.string()).default([]),
  color: z.number().gte(0).lte(20).nullable().default(null),
  servingStyle: ServingStyleEnum.nullable().default(null),
  friends: z.array(UserSchema).default([]),

  awards: z.array(BadgeAwardSchema).readonly(),
  comments: z.number().gte(0).readonly(),
  toasts: z.number().gte(0).readonly(),
  hasToasted: z.boolean().optional().readonly(),

  createdAt: z.string().datetime().readonly(),
  createdBy: UserSchema.readonly(),
});

export const TastingInputSchema = TastingSchema.omit({
  id: true,
  awards: true,
  comments: true,
  toasts: true,
  hasToasted: true,
  createdBy: true,
}).extend({
  bottle: z.number(),
  edition: z
    .number()
    .nullish()
    .describe(
      "The edition of the bottle, if applicable. e.g. 'Ardbeg Supernova 2023'",
    ),
  flight: z.string().nullish(),
  createdAt: zDatetime.nullish(),
  image: z.null().optional(),
  friends: z.array(z.number()).default([]),
});
