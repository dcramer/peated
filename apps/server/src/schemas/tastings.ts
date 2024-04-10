import { z } from "zod";
import { SERVING_STYLE_LIST } from "../constants";
import { BottleSchema, FlavorProfileEnum } from "./bottles";
import { UserSchema } from "./users";

export const ServiceStyleEnum = z.enum(SERVING_STYLE_LIST);

export const TastingSchema = z.object({
  id: z.number(),
  imageUrl: z.string().nullable(),
  notes: z.string().nullable(),
  bottle: BottleSchema,
  rating: z.number().gte(0).lte(5).nullable(),
  tags: z.array(z.string()),
  flavorProfile: FlavorProfileEnum.nullable(),
  servingStyle: ServiceStyleEnum.nullable(),
  friends: z.array(UserSchema),

  comments: z.number().gte(0),
  toasts: z.number().gte(0),
  hasToasted: z.boolean().optional(),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
});

export const TastingInputSchema = z.object({
  bottle: z.number(),
  notes: z.string().nullable().optional(),
  rating: z.number().gte(0).lte(5).nullable().optional(),
  tags: z.array(z.string()).max(15).nullable().optional(),
  flavorProfile: FlavorProfileEnum.nullable().optional(),

  servingStyle: ServiceStyleEnum.nullable().optional(),
  friends: z.array(z.number()).optional(),
  flight: z.string().nullable().optional(),

  createdAt: z.string().datetime().optional(),
});

export const TastingUpdateSchema = z.object({
  notes: z.string().nullable().optional(),
  rating: z.number().gte(0).lte(5).nullable().optional(),
  tags: z.array(z.string()).max(15).nullable().optional(),
  servingStyle: ServiceStyleEnum.nullable().optional(),
  friends: z.array(z.number()).optional(),
  flight: z.string().nullable().optional(),
});
