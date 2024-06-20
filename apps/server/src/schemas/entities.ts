import { z } from "zod";

import { ENTITY_TYPE_LIST } from "../constants";
import { ContentSourceEnum } from "./common";
import { CountrySchema } from "./countries";
import { PointSchema } from "./shared";
import { UserSchema } from "./users";

export const EntityTypeEnum = z.enum(ENTITY_TYPE_LIST);

export const EntityInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  shortName: z.string().trim().nullable().optional(),
  type: z.array(EntityTypeEnum).optional(),
  country: z.string().trim().nullable().optional(),
  region: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  location: PointSchema.nullable().optional(),
  description: z.string().trim().nullable().optional(),
  descriptionSrc: ContentSourceEnum.nullable().optional(),
  yearEstablished: z
    .number()
    .lte(new Date().getFullYear())
    .nullable()
    .optional(),
  website: z.string().url().nullable().optional(),
});

export const EntitySchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  shortName: z.string().trim().nullable(),
  type: z.array(EntityTypeEnum),
  description: z.string().nullable().optional(),
  yearEstablished: z.number().lte(new Date().getFullYear()).nullable(),
  website: z.string().url().nullable(),
  country: CountrySchema.nullable(),
  region: z.string().trim().nullable(),
  address: z.string().trim().nullable().optional(),
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
