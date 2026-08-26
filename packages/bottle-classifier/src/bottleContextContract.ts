import { z } from "zod";

import {
  BottleExtractedDetailsSchema,
  EntityTypeEnum,
  ProposedBottleFields,
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
type ObservationValue =
  | boolean
  | null
  | number
  | ObservationValue[]
  | string
  | { [key: string]: ObservationValue };
const ObservationValueSchema: z.ZodType<ObservationValue, ObservationValue> =
  z.lazy(() =>
    z.union([
      z.string(),
      z.number().finite(),
      z.boolean(),
      z.null(),
      z.array(ObservationValueSchema),
      z.record(z.string(), ObservationValueSchema),
    ]),
  );
const BoundedObservationDataSchema = z
  .record(z.string(), ObservationValueSchema)
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

export const BottleContextSharedFields = {
  name: ProposedBottleFields.name,
  statedAge: ProposedBottleFields.statedAge.removeDefault(),
  series: BottleContextSeriesRefSchema.nullable(),
  category: ProposedBottleFields.category.removeDefault(),
  brand: BottleContextEntityRefSchema,
  distillers: z.array(BottleContextEntityRefSchema),
  bottler: BottleContextEntityRefSchema.nullable(),
} as const;

export const BottleContextSharedSchema = z
  .object(BottleContextSharedFields)
  .strict();

export const BottleContextExactFields = {
  edition: ProposedBottleFields.edition.removeDefault(),
  statedAge: ProposedBottleFields.statedAge.removeDefault(),
  abv: ProposedBottleFields.abv.removeDefault(),
  singleCask: ProposedBottleFields.singleCask.removeDefault(),
  caskStrength: ProposedBottleFields.caskStrength.removeDefault(),
  vintageYear: ProposedBottleFields.vintageYear.removeDefault(),
  bottlingYear: ProposedBottleFields.bottlingYear,
  releaseYear: ProposedBottleFields.releaseYear.removeDefault(),
  caskSize: ProposedBottleFields.caskSize.removeDefault(),
  caskType: ProposedBottleFields.caskType.removeDefault(),
  caskFill: ProposedBottleFields.caskFill.removeDefault(),
} as const;

export const BottleContextExactSchema = z
  .object(BottleContextExactFields)
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

export const EntityContextFields = {
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
} as const;

export const EntityContextSchema = z.object(EntityContextFields).strict();

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
