import { z } from "zod";
import { BottleReleaseSchema } from "./bottleReleases";
import { BottleSchema } from "./bottles";
import { UserSchema } from "./users";

export const CollectionSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  totalBottles: z.number(),
  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const CollectionInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
});

export const CollectionBottleSchema = z.object({
  id: z.number(),
  bottle: BottleSchema,
  release: BottleReleaseSchema.nullish(),
});

export const CollectionBottleInputSchema = z.object({
  bottle: z.number(),
  release: z.number().nullish(),
});
