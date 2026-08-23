import { z } from "zod";

import { ContentSourceEnum, EntityTypeEnum } from "./common";
import { CountrySchema } from "./countries";
import { RegionSchema } from "./regions";
import { PointSchema } from "./shared";

const EntityNameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .describe("Name of the entity (brand, distillery, etc.)");
const EntityShortNameSchema = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .describe("Abbreviated or short name for the entity");
const EntityTypesSchema = z
  .array(EntityTypeEnum)
  .default([])
  .describe("Types that classify this entity (e.g., brand, distillery)");
const EntityDescriptionSchema = z
  .string()
  .nullish()
  .default(null)
  .describe("Detailed description of the entity");
const EntityDescriptionSourceSchema = ContentSourceEnum.nullable()
  .default(null)
  .optional()
  .describe("Source of the entity description");
const EntityYearEstablishedSchema = z
  .number()
  .lte(new Date().getFullYear())
  .nullable()
  .default(null)
  .describe("Year the entity was established");
const EntityWebsiteSchema = z
  .string()
  .url()
  .nullable()
  .default(null)
  .describe("Official website URL");
const EntityAddressSchema = z
  .string()
  .trim()
  .nullish()
  .default(null)
  .describe("Physical address of the entity");
const EntityLocationSchema = PointSchema.nullable()
  .default(null)
  .describe("Geographic coordinates of the entity");

export const EntitySchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the entity"),
  name: EntityNameSchema,
  shortName: EntityShortNameSchema,
  type: EntityTypesSchema,
  description: EntityDescriptionSchema,
  descriptionSrc: EntityDescriptionSourceSchema,
  yearEstablished: EntityYearEstablishedSchema,
  website: EntityWebsiteSchema,
  country: CountrySchema.nullable()
    .default(null)
    .describe("Country where the entity is located"),
  region: RegionSchema.nullable()
    .default(null)
    .describe("Region where the entity is located"),
  address: EntityAddressSchema,
  location: EntityLocationSchema,

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

export const EntityInputFields = {
  name: EntityNameSchema,
  shortName: EntityShortNameSchema,
  type: EntityTypesSchema,
  description: EntityDescriptionSchema,
  descriptionSrc: EntityDescriptionSourceSchema,
  yearEstablished: EntityYearEstablishedSchema,
  website: EntityWebsiteSchema,
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
  address: EntityAddressSchema,
  location: EntityLocationSchema,
} as const;

export const EntityInputSchema = z.object(EntityInputFields);

export const EntityMergeSchema = z.object({
  // TODO: rename to entity
  entityId: z.number().describe("ID of the entity to merge"),
  direction: z
    .enum(["mergeInto", "mergeFrom"])
    .describe("Direction of the merge operation"),
});
