import { z } from "zod";

import { ContentSourceEnum, EntityTypeEnum } from "./common";
import { CountrySchema } from "./countries";
import { RegionSchema } from "./regions";
import { PointSchema } from "./shared";

export const EntitySchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the entity"),
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Name of the entity (brand, distillery, etc.)"),
  shortName: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .describe("Abbreviated or short name for the entity"),
  type: z
    .array(EntityTypeEnum)
    .default([])
    .describe("Types that classify this entity (e.g., brand, distillery)"),
  description: z
    .string()
    .nullish()
    .default(null)
    .describe("Detailed description of the entity"),
  descriptionSrc: ContentSourceEnum.nullable()
    .default(null)
    .optional()
    .describe("Source of the entity description"),
  yearEstablished: z
    .number()
    .lte(new Date().getFullYear())
    .nullable()
    .default(null)
    .describe("Year the entity was established"),
  website: z
    .string()
    .url()
    .nullable()
    .default(null)
    .describe("Official website URL"),
  country: CountrySchema.nullable()
    .default(null)
    .describe("Country where the entity is located"),
  region: RegionSchema.nullable()
    .default(null)
    .describe("Region where the entity is located"),
  address: z
    .string()
    .trim()
    .nullish()
    .default(null)
    .describe("Physical address of the entity"),
  location: PointSchema.nullable()
    .default(null)
    .describe("Geographic coordinates of the entity"),

  totalTastings: z
    .number()
    .readonly()
    .describe("Total number of tastings for bottles from this entity"),
  totalBottles: z
    .number()
    .readonly()
    .describe("Total number of bottles associated with this entity"),

  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the entity was created"),
  updatedAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the entity was last updated"),
});

export const EntityInputSchema = EntitySchema.omit({
  id: true,
  totalTastings: true,
  totalBottles: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  country: z
    .number()
    .nullish()
    .default(null)
    .describe("Country ID where the entity is located"),
  region: z
    .number()
    .nullish()
    .default(null)
    .describe("Region ID where the entity is located"),
});

export const EntityMergeSchema = z.object({
  // TODO: rename to entity
  entityId: z.number().describe("ID of the entity to merge"),
  direction: z
    .enum(["mergeInto", "mergeFrom"])
    .describe("Direction of the merge operation"),
});
