import { z } from "zod";

import { ContentSourceEnum, EntityTypeEnum } from "./common";
import { CountrySchema } from "./countries";
import { RegionSchema } from "./regions";
import { PointSchema } from "./shared";
import { UserSchema } from "./users";

export const EntityInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  shortName: z.string().trim().nullish(),
  type: z.array(EntityTypeEnum).optional(),
  country: z.number().nullish(),
  region: z.number().nullish(),
  address: z.string().trim().nullish(),
  location: PointSchema.nullish(),
  description: z.string().trim().nullish(),
  descriptionSrc: ContentSourceEnum.nullish(),
  yearEstablished: z.number().lte(new Date().getFullYear()).nullish(),
  website: z.string().url().nullish(),
});

export const EntitySchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  shortName: z.string().trim().nullable(),
  type: z.array(EntityTypeEnum),
  description: z.string().nullish(),
  yearEstablished: z.number().lte(new Date().getFullYear()).nullable(),
  website: z.string().url().nullable(),
  country: CountrySchema.nullable(),
  region: RegionSchema.nullable(),
  address: z.string().trim().nullish(),
  location: PointSchema.nullable(),

  totalTastings: z.number(),
  totalBottles: z.number(),

  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const EntityMergeSchema = z.object({
  entityId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});
