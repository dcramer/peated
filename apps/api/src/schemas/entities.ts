import { z } from "zod";

import { ContentSourceEnum, EntityTypeEnum } from "./common";
import { CountrySchema } from "./countries";
import { RegionSchema } from "./regions";
import { PointSchema } from "./shared";

export const EntitySchema = z.object({
  id: z.number().readonly(),
  name: z.string().trim().min(1, "Required"),
  shortName: z.string().trim().nullable().default(null),
  type: z.array(EntityTypeEnum).default([]),
  description: z.string().nullish().default(null),
  descriptionSrc: ContentSourceEnum.nullable().default(null).optional(),
  yearEstablished: z
    .number()
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  website: z.string().url().nullable().default(null),
  country: CountrySchema.nullable().default(null),
  region: RegionSchema.nullable().default(null),
  address: z.string().trim().nullish().default(null),
  location: PointSchema.nullable().default(null),

  totalTastings: z.number().readonly(),
  totalBottles: z.number().readonly(),

  createdAt: z.string().datetime().readonly(),
  updatedAt: z.string().datetime().readonly(),
});

export const EntityInputSchema = EntitySchema.omit({
  id: true,
  totalTastings: true,
  totalBottles: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  country: z.number().nullish().default(null),
  region: z.number().nullish().default(null),
});

export const EntityMergeSchema = z.object({
  // TODO: rename to entity
  entityId: z.number(),
  direction: z.enum(["mergeInto", "mergeFrom"]),
});
