import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleExtractedDetailsSchema,
  BottleMatchDecisionSchema,
  BottleSearchEvidenceSchema,
  EntityResolutionSchema,
} from "./schemas";

// This is the stable public contract for bottle classification. Keep this file
// small, schema-backed, and decoupled from price-matching persistence so evals
// and future callers can rely on one clean interface.

export const BottleReferenceSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullable().optional(),
    externalSiteId: z.number().int().nullable().optional(),
    name: z.string().trim().min(1),
    url: z.string().url().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    currentBottleId: z.number().int().nullable().optional(),
    currentReleaseId: z.number().int().nullable().optional(),
  })
  .strict();

export const BottleClassificationArtifactsSchema = z
  .object({
    extractedIdentity: BottleExtractedDetailsSchema.nullable().default(null),
    candidates: z.array(BottleCandidateSchema).default([]),
    searchEvidence: z.array(BottleSearchEvidenceSchema).default([]),
    resolvedEntities: z.array(EntityResolutionSchema).default([]),
  })
  .strict();

export const ClassifyBottleReferenceInputSchema = z
  .object({
    reference: BottleReferenceSchema,
    extractedIdentity: BottleExtractedDetailsSchema.nullable().optional(),
    initialCandidates: z.array(BottleCandidateSchema).optional(),
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
    decision: BottleMatchDecisionSchema,
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
export type ClassifyBottleReferenceInput = z.infer<
  typeof ClassifyBottleReferenceInputSchema
>;
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
  decision: z.infer<typeof BottleMatchDecisionSchema>;
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
