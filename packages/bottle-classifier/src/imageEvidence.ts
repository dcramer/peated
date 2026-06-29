import { z } from "zod";

const ConfidenceSchema = z.number().min(0).max(1);

export const ImageTextRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .superRefine((region, ctx) => {
    if (region.x + region.width > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "region extends beyond the right image edge",
        path: ["width"],
      });
    }

    if (region.y + region.height > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "region extends beyond the bottom image edge",
        path: ["height"],
      });
    }
  });

export const ImageTextSpanSchema = z
  .object({
    text: z.string().trim().min(1),
    confidence: ConfidenceSchema,
    region: ImageTextRegionSchema.optional(),
  })
  .strict();

export const ImageEvidenceExtractorKindSchema = z.enum(["ocr", "vision"]);

export const ImageEvidenceExtractorSchema = z
  .object({
    kind: ImageEvidenceExtractorKindSchema,
    model: z.string().trim().min(1).optional(),
    confidence: ConfidenceSchema,
    textSpans: z.array(ImageTextSpanSchema).default([]),
    observations: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

const createEvidenceFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z
    .object({
      value: valueSchema,
      confidence: ConfidenceSchema,
      sourceExtractorIndexes: z.array(z.number().int().min(0)).optional(),
    })
    .strict();

const EvidenceStringFieldSchema = createEvidenceFieldSchema(
  z.string().trim().min(1),
);
const EvidenceAgeFieldSchema = createEvidenceFieldSchema(
  z.number().int().min(0).max(100),
);
const EvidenceAbvFieldSchema = createEvidenceFieldSchema(
  z.number().positive().max(100),
);
const EvidenceYearValueSchema = z
  .number()
  .int()
  .gte(1800)
  .superRefine((year, ctx) => {
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: currentYear,
        inclusive: true,
        origin: "number",
        message: `Year must be less than or equal to ${currentYear}`,
      });
    }
  });
const EvidenceYearFieldSchema = createEvidenceFieldSchema(
  EvidenceYearValueSchema,
);

export const ImageBottleFieldCandidatesSchema = z
  .object({
    brand: EvidenceStringFieldSchema.optional(),
    expression: EvidenceStringFieldSchema.optional(),
    statedAge: EvidenceAgeFieldSchema.optional(),
    abv: EvidenceAbvFieldSchema.optional(),
    vintageYear: EvidenceYearFieldSchema.optional(),
    releaseYear: EvidenceYearFieldSchema.optional(),
    edition: EvidenceStringFieldSchema.optional(),
    caskType: EvidenceStringFieldSchema.optional(),
    caskNumber: EvidenceStringFieldSchema.optional(),
  })
  .strict();

export const ImagePhotoSuitabilitySchema = z
  .object({
    isSingleBottlePhoto: z.boolean(),
    labelReadable: z.boolean(),
    suitableAsTastingImage: z.boolean(),
    suitableAsBottleImage: z.boolean(),
    reason: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const ImageBottleEvidenceConflictSchema = z
  .object({
    field: z.string().trim().min(1),
    values: z.array(z.unknown()).min(2),
    reason: z.string().trim().min(1),
  })
  .strict();

export const ImageBottleEvidenceSchema = z
  .object({
    sourceImageId: z.string().trim().min(1),
    sourceImageHash: z.string().trim().min(1).optional(),
    extractors: z.array(ImageEvidenceExtractorSchema).min(1),
    fieldCandidates: ImageBottleFieldCandidatesSchema.default({}),
    photoSuitability: ImagePhotoSuitabilitySchema,
    conflicts: z.array(ImageBottleEvidenceConflictSchema).default([]),
  })
  .strict();

export const ImageEvidenceExtractorOutputSchema = ImageEvidenceExtractorSchema;

export type ImageTextRegion = z.infer<typeof ImageTextRegionSchema>;
export type ImageTextSpan = z.infer<typeof ImageTextSpanSchema>;
export type ImageEvidenceExtractorKind = z.infer<
  typeof ImageEvidenceExtractorKindSchema
>;
export type ImageEvidenceExtractorOutput = z.infer<
  typeof ImageEvidenceExtractorOutputSchema
>;
export type ImageBottleFieldCandidates = z.infer<
  typeof ImageBottleFieldCandidatesSchema
>;
export type ImagePhotoSuitability = z.infer<typeof ImagePhotoSuitabilitySchema>;
export type ImageBottleEvidenceConflict = z.infer<
  typeof ImageBottleEvidenceConflictSchema
>;
export type ImageBottleEvidence = z.infer<typeof ImageBottleEvidenceSchema>;

export interface ImageEvidenceExtractorAdapter {
  readonly kind: ImageEvidenceExtractorKind;
  extract(input: {
    imageId: string;
    imageUrl: string;
  }): Promise<ImageEvidenceExtractorOutput>;
}
