import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleClassificationDecisionSchema,
  BottleExtractedDetailsSchema,
  BottleSearchEvidenceSchema,
  EntityResolutionSchema,
} from "./classifierTypes";
import { ImageBottleEvidenceSchema } from "./imageEvidence";

export { BottleCandidateSchema } from "./classifierTypes";
export {
  ImageBottleEvidenceConflictSchema,
  ImageBottleEvidenceSchema,
  ImageBottleFieldCandidatesSchema,
  ImageEvidenceExtractorKindSchema,
  ImageEvidenceExtractorOutputSchema,
  ImageEvidenceExtractorSchema,
  ImagePhotoSuitabilitySchema,
  ImageTextRegionSchema,
  ImageTextSpanSchema,
} from "./imageEvidence";
export type {
  ImageBottleEvidence,
  ImageBottleEvidenceConflict,
  ImageBottleFieldCandidates,
  ImageEvidenceExtractorAdapter,
  ImageEvidenceExtractorKind,
  ImageEvidenceExtractorOutput,
  ImagePhotoSuitability,
  ImageTextRegion,
  ImageTextSpan,
} from "./imageEvidence";

function normalizeHttpUrl(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

const DataImageUrlSchema = z
  .string()
  .regex(/^data:image\/(?:gif|jpe?g|png|webp);base64,[a-z0-9+/]+={0,2}$/i);

const BottleReferenceUrlSchema = z.preprocess(
  normalizeHttpUrl,
  z.string().url().nullable().optional(),
);

const BottleReferenceImageUrlSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmedValue = value.trim();
      if (DataImageUrlSchema.safeParse(trimmedValue).success) {
        return trimmedValue;
      }
    }

    return normalizeHttpUrl(value);
  },
  z.union([z.string().url(), DataImageUrlSchema]).nullable().optional(),
);

export const BottleReferenceSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullable().optional(),
    externalSiteId: z.number().int().nullable().optional(),
    name: z.string().trim().min(1),
    url: BottleReferenceUrlSchema,
    imageUrl: BottleReferenceImageUrlSchema,
    currentBottleId: z.number().int().nullable().optional(),
    currentReleaseId: z.number().int().nullable().optional(),
  })
  .strict();

export const BottleClassificationArtifactsSchema = z
  .object({
    extractedIdentity: BottleExtractedDetailsSchema.nullable().default(null),
    // Direct artifact fixtures may omit image evidence; the builder normalizes
    // that compatibility path to null for runtime consumers.
    imageEvidence: ImageBottleEvidenceSchema.nullable().optional(),
    candidates: z.array(BottleCandidateSchema).default([]),
    searchEvidence: z.array(BottleSearchEvidenceSchema).default([]),
    resolvedEntities: z.array(EntityResolutionSchema).default([]),
  })
  .strict();

export const CandidateExpansionModeSchema = z.enum(["open", "initial_only"]);

export const ClassifyBottleReferenceInputSchema = z
  .object({
    reference: BottleReferenceSchema,
    extractedIdentity: BottleExtractedDetailsSchema.nullable().optional(),
    imageEvidence: ImageBottleEvidenceSchema.nullable().optional(),
    initialCandidates: z.array(BottleCandidateSchema).optional(),
    candidateExpansion: CandidateExpansionModeSchema.default("open"),
  })
  .strict();

export const IgnoredBottleClassificationResultSchema = z
  .object({
    status: z.literal("ignored"),
    reason: z.string().min(1),
    artifacts: BottleClassificationArtifactsSchema,
  })
  .strict();

export const DecidedBottleClassificationResultSchema = z
  .object({
    status: z.literal("classified"),
    decision: BottleClassificationDecisionSchema,
    artifacts: BottleClassificationArtifactsSchema,
  })
  .strict();

export const BottleClassificationResultSchema = z.discriminatedUnion("status", [
  IgnoredBottleClassificationResultSchema,
  DecidedBottleClassificationResultSchema,
]);

export type BottleReference = z.infer<typeof BottleReferenceSchema>;
export type BottleClassificationArtifacts = z.infer<
  typeof BottleClassificationArtifactsSchema
>;
export type CandidateExpansionMode = z.infer<
  typeof CandidateExpansionModeSchema
>;
export type ClassifyBottleReferenceInput = {
  reference: BottleReference;
  extractedIdentity?: null | z.infer<typeof BottleExtractedDetailsSchema>;
  imageEvidence?: null | z.infer<typeof ImageBottleEvidenceSchema>;
  initialCandidates?: z.infer<typeof BottleCandidateSchema>[];
  candidateExpansion?: CandidateExpansionMode;
};
export type IgnoredBottleClassificationResult = z.infer<
  typeof IgnoredBottleClassificationResultSchema
>;
export type DecidedBottleClassificationResult = z.infer<
  typeof DecidedBottleClassificationResultSchema
>;
export type BottleClassificationResult = z.infer<
  typeof BottleClassificationResultSchema
>;

export function buildBottleClassificationArtifacts(
  artifacts: Partial<BottleClassificationArtifacts>,
): BottleClassificationArtifacts {
  return BottleClassificationArtifactsSchema.parse({
    extractedIdentity: null,
    imageEvidence: null,
    candidates: [],
    searchEvidence: [],
    resolvedEntities: [],
    ...artifacts,
  });
}

export function createIgnoredBottleClassification({
  reason,
  artifacts,
}: {
  reason: string;
  artifacts: Partial<BottleClassificationArtifacts>;
}): IgnoredBottleClassificationResult {
  return IgnoredBottleClassificationResultSchema.parse({
    status: "ignored",
    reason,
    artifacts: buildBottleClassificationArtifacts(artifacts),
  });
}

export function createDecidedBottleClassification({
  decision,
  artifacts,
}: {
  decision: z.infer<typeof BottleClassificationDecisionSchema>;
  artifacts: Partial<BottleClassificationArtifacts>;
}): DecidedBottleClassificationResult {
  return DecidedBottleClassificationResultSchema.parse({
    status: "classified",
    decision,
    artifacts: buildBottleClassificationArtifacts(artifacts),
  });
}

export function isIgnoredBottleClassification(
  classification: BottleClassificationResult,
): classification is IgnoredBottleClassificationResult {
  return classification.status === "ignored";
}
