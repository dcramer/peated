import { z } from "zod";

import {
  BottleExtractedDetailsSchema,
  EntityTypeEnum,
  ProposedBottleSchema,
} from "./classifierTypes";

export const MAX_BOTTLE_CONTEXT_ALIASES = 12;
export const MAX_BOTTLE_CONTEXT_SIBLINGS = 12;
export const MAX_BOTTLE_CONTEXT_OBSERVATIONS = 8;
export const MAX_BOTTLE_CONTEXT_IMAGES = 3;
export const MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH = 2_000;
export const MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH = 4_000;
export const MAX_ENTITY_CONTEXT_ALIASES = 12;
export const MAX_ENTITY_CONTEXT_BOTTLES = 8;

const PositiveIdSchema = z.number().int().positive();
const NonEmptyTextSchema = z.string().trim().min(1);
const HttpUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Expected an HTTP or HTTPS URL",
  });
const BoundedObservationDataSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) =>
      JSON.stringify(value).length <=
      MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH,
    {
      message: "Observation data exceeds the Bottle context bound",
    },
  );

export const BottleContextEntityRefSchema = z
  .object({
    entityId: PositiveIdSchema,
    name: NonEmptyTextSchema,
  })
  .strict();

export const BottleContextSeriesRefSchema = z
  .object({
    seriesId: PositiveIdSchema,
    name: NonEmptyTextSchema,
  })
  .strict();

export const BottleContextSharedSchema = z
  .object({
    name: ProposedBottleSchema.shape.name,
    statedAge: ProposedBottleSchema.shape.statedAge.removeDefault(),
    series: BottleContextSeriesRefSchema.nullable(),
    category: ProposedBottleSchema.shape.category.removeDefault(),
    brand: BottleContextEntityRefSchema,
    distillers: z.array(BottleContextEntityRefSchema),
    bottler: BottleContextEntityRefSchema.nullable(),
  })
  .strict();

export const BottleContextExactSchema = z
  .object({
    edition: ProposedBottleSchema.shape.edition.removeDefault(),
    statedAge: ProposedBottleSchema.shape.statedAge.removeDefault(),
    abv: ProposedBottleSchema.shape.abv.removeDefault(),
    singleCask: ProposedBottleSchema.shape.singleCask.removeDefault(),
    caskStrength: ProposedBottleSchema.shape.caskStrength.removeDefault(),
    vintageYear: ProposedBottleSchema.shape.vintageYear.removeDefault(),
    releaseYear: ProposedBottleSchema.shape.releaseYear.removeDefault(),
    caskSize: ProposedBottleSchema.shape.caskSize.removeDefault(),
    caskType: ProposedBottleSchema.shape.caskType.removeDefault(),
    caskFill: ProposedBottleSchema.shape.caskFill.removeDefault(),
  })
  .strict();

export const BottleContextSiblingSchema = z
  .object({
    bottleId: PositiveIdSchema,
    fullName: NonEmptyTextSchema,
    exact: BottleContextExactSchema,
  })
  .strict();

export const BottleContextObservationSchema = z
  .object({
    sourceType: NonEmptyTextSchema,
    sourceKey: NonEmptyTextSchema,
    sourceName: NonEmptyTextSchema,
    sourceUrl: HttpUrlSchema.nullable(),
    rawText: NonEmptyTextSchema.max(
      MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH,
    ).nullable(),
    parsedIdentity: BoundedObservationDataSchema.nullable(),
    facts: BoundedObservationDataSchema.nullable(),
  })
  .strict();

export const BottleContextAliasSchema = z
  .object({
    name: NonEmptyTextSchema,
    ignored: z.boolean(),
  })
  .strict();

export const BottleContextImageSourceSchema = z
  .object({
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("bottle") }).strict(),
      z
        .object({
          kind: z.literal("tasting"),
          tastingId: PositiveIdSchema,
        })
        .strict(),
    ]),
    url: HttpUrlSchema,
  })
  .strict();

export const BottleContextLabelEvidenceSchema = z
  .object({
    sourceImageId: NonEmptyTextSchema,
    model: NonEmptyTextSchema,
    extractedIdentity: BottleExtractedDetailsSchema.nullable(),
    rawLabelText: z.string().trim().min(1).max(4000).nullable().default(null),
  })
  .strict();

export const BottleContextPublicImageSchema =
  BottleContextImageSourceSchema.extend({
    labelEvidence: BottleContextLabelEvidenceSchema,
  }).strict();

const BottleContextBaseSchema = z
  .object({
    bottleId: PositiveIdSchema,
    fullName: NonEmptyTextSchema,
    groupId: PositiveIdSchema.nullable(),
    shared: BottleContextSharedSchema,
    exact: BottleContextExactSchema,
    siblings: z
      .array(BottleContextSiblingSchema)
      .max(MAX_BOTTLE_CONTEXT_SIBLINGS),
    aliases: z.array(BottleContextAliasSchema).max(MAX_BOTTLE_CONTEXT_ALIASES),
    observations: z
      .array(BottleContextObservationSchema)
      .max(MAX_BOTTLE_CONTEXT_OBSERVATIONS),
  })
  .strict();

export const BottleContextSourceSchema = BottleContextBaseSchema.extend({
  imageSources: z
    .array(BottleContextImageSourceSchema)
    .max(MAX_BOTTLE_CONTEXT_IMAGES),
}).strict();

export const BottleContextSchema = BottleContextBaseSchema.extend({
  publicImages: z
    .array(BottleContextPublicImageSchema)
    .max(MAX_BOTTLE_CONTEXT_IMAGES),
}).strict();

export const EntityContextBottleSampleSchema = z
  .object({
    bottleId: PositiveIdSchema,
    fullName: NonEmptyTextSchema,
    relationships: z.array(EntityTypeEnum).nonempty(),
  })
  .strict();

export const EntityContextSchema = z
  .object({
    entityId: PositiveIdSchema,
    name: NonEmptyTextSchema,
    shortName: NonEmptyTextSchema.nullable(),
    roles: z.array(EntityTypeEnum),
    website: HttpUrlSchema.nullable(),
    country: NonEmptyTextSchema.nullable(),
    region: NonEmptyTextSchema.nullable(),
    yearEstablished: z.number().int().nullable(),
    aliases: z.array(NonEmptyTextSchema).max(MAX_ENTITY_CONTEXT_ALIASES),
    relatedBottles: z
      .array(EntityContextBottleSampleSchema)
      .max(MAX_ENTITY_CONTEXT_BOTTLES),
  })
  .strict();

export type BottleContextEntityRef = z.infer<
  typeof BottleContextEntityRefSchema
>;
export type BottleContextSeriesRef = z.infer<
  typeof BottleContextSeriesRefSchema
>;
export type BottleContextShared = z.infer<typeof BottleContextSharedSchema>;
export type BottleContextExact = z.infer<typeof BottleContextExactSchema>;
export type BottleContextSibling = z.infer<typeof BottleContextSiblingSchema>;
export type BottleContextObservation = z.infer<
  typeof BottleContextObservationSchema
>;
export type BottleContextAlias = z.infer<typeof BottleContextAliasSchema>;
export type BottleContextImageSource = z.infer<
  typeof BottleContextImageSourceSchema
>;
export type BottleContextLabelEvidence = z.infer<
  typeof BottleContextLabelEvidenceSchema
>;
export type BottleContextPublicImage = z.infer<
  typeof BottleContextPublicImageSchema
>;
export type BottleContextSource = z.infer<typeof BottleContextSourceSchema>;
export type BottleContext = z.infer<typeof BottleContextSchema>;
export type EntityContextBottleSample = z.infer<
  typeof EntityContextBottleSampleSchema
>;
export type EntityContext = z.infer<typeof EntityContextSchema>;
