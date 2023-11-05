import { z } from "zod";

import { ENTITY_TYPE_LIST } from "../constants";
import { PointSchema } from "./shared";
import { UserSchema } from "./users";

export const EntityTypeEnum = z.enum(ENTITY_TYPE_LIST);

export const EntityInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  country: z.string().trim().nullable().optional(),
  region: z.string().trim().nullable().optional(),
  yearEstablished: z
    .number()
    .lte(new Date().getFullYear())
    .nullable()
    .optional(),
  website: z.string().url().nullable().optional(),
  type: z.array(EntityTypeEnum).optional(),
  location: PointSchema.nullable().optional(),
});

export const EntitySchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  description: z.string().nullable().optional(),
  yearEstablished: z.number().lte(new Date().getFullYear()).nullable(),
  website: z.string().url().nullable(),
  country: z.string().trim().nullable(),
  region: z.string().trim().nullable(),
  type: z.array(EntityTypeEnum),
  location: PointSchema.nullable(),

  totalTastings: z.number(),
  totalBottles: z.number(),

  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const EntityMergeSchema = z.object({
  entityId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});
