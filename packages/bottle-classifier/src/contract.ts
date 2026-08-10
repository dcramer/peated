import { z } from "zod";
import {
  FindingSchema,
  ProposedOperationsSchema,
  type AuditBottleInput,
  type Finding,
  type ProposedOperation,
} from "./bottleCheckContract";
import {
  BottleContextSchema,
  EntityContextSchema,
} from "./bottleContextContract";
import {
  BottleCandidateSchema,
  BottleClassificationDecisionSchema,
  BottleExtractedDetailsSchema,
  BottleSearchEvidenceSchema,
  EntityResolutionSchema,
} from "./classifierTypes";
import { ImageBottleEvidenceSchema } from "./imageEvidence";

export {
  AuditBottleInputSchema,
  AuditBottleOriginSchema,
  BottleCheckIntentSchema,
  BottleExactPatchSchema,
  BottleOperationEntityChoiceSchema,
  BottleSharedPatchSchema,
  BottleUpdatePatchSchema,
  DEFAULT_MAX_PROPOSED_OPERATIONS,
  EntityIdentityPatchSchema,
  EvidenceRefSchema,
  FindingSchema,
  MergeBottlesOperationSchema,
  MergeEntitiesOperationSchema,
  ProposedEntityDraftSchema,
  ProposedOperationSchema,
  ProposedOperationsSchema,
  ProposedOperationTypeSchema,
  SourceEvidencePathSchema,
  UpdateBottleOperationSchema,
  UpdateEntityOperationSchema,
} from "./bottleCheckContract";
export type {
  AuditBottleInput,
  AuditBottleOrigin,
  BottleCheckIntent,
  BottleExactPatch,
  BottleOperationEntityChoice,
  BottleSharedPatch,
  BottleUpdatePatch,
  EntityIdentityPatch,
  EvidenceRef,
  Finding,
  MergeBottlesOperation,
  MergeEntitiesOperation,
  ProposedEntityDraft,
  ProposedOperation,
  ProposedOperationType,
  UpdateBottleOperation,
  UpdateEntityOperation,
} from "./bottleCheckContract";
export {
  BottleContextAliasSchema,
  BottleContextEntityRefSchema,
  BottleContextExactSchema,
  BottleContextImageSourceSchema,
  BottleContextLabelEvidenceSchema,
  BottleContextObservationSchema,
  BottleContextPublicImageSchema,
  BottleContextSchema,
  BottleContextSeriesRefSchema,
  BottleContextSharedSchema,
  BottleContextSiblingSchema,
  BottleContextSourceSchema,
  EntityContextBottleSampleSchema,
  EntityContextSchema,
  MAX_BOTTLE_CONTEXT_ALIASES,
  MAX_BOTTLE_CONTEXT_IMAGES,
  MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH,
  MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH,
  MAX_BOTTLE_CONTEXT_OBSERVATIONS,
  MAX_BOTTLE_CONTEXT_SIBLINGS,
  MAX_ENTITY_CONTEXT_ALIASES,
  MAX_ENTITY_CONTEXT_BOTTLES,
} from "./bottleContextContract";
export type {
  BottleContext,
  BottleContextAlias,
  BottleContextEntityRef,
  BottleContextExact,
  BottleContextImageSource,
  BottleContextLabelEvidence,
  BottleContextObservation,
  BottleContextPublicImage,
  BottleContextSeriesRef,
  BottleContextShared,
  BottleContextSibling,
  BottleContextSource,
  EntityContext,
  EntityContextBottleSample,
} from "./bottleContextContract";
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
    bottleContexts: z.array(BottleContextSchema).default([]),
    entityContexts: z.array(EntityContextSchema).default([]),
  })
  .strict();

export const CandidateExpansionModeSchema = z.enum(["open", "initial_only"]);

export const ClassifyBottleReferenceInputSchema = z
  .object({
    reference: BottleReferenceSchema,
    conversationId: z.string().trim().min(1).optional(),
    extractedIdentity: BottleExtractedDetailsSchema.nullable().optional(),
    imageEvidence: ImageBottleEvidenceSchema.nullable().optional(),
    initialCandidates: z.array(BottleCandidateSchema).optional(),
    candidateExpansion: CandidateExpansionModeSchema.default("open"),
  })
  .strict();

const BOTTLE_REFERENCE_EVIDENCE_FIELDS = [
  "id",
  "externalSiteId",
  "name",
  "url",
  "imageUrl",
  "currentBottleId",
] as const satisfies readonly (keyof BottleReference)[];

type BottleCheckEvidenceSource =
  | {
      intent: "audit_bottle";
      input: AuditBottleInput;
      artifacts: BottleClassificationArtifacts;
    }
  | {
      intent: "resolve_reference";
      input: {
        reference: Partial<Record<keyof BottleReference, unknown>>;
      };
      artifacts: BottleClassificationArtifacts;
    };

export function getBottleCheckSourceEvidencePaths(
  source: BottleCheckEvidenceSource,
): string[] {
  if (source.intent === "audit_bottle") {
    return source.input.note === undefined ? [] : ["audit.note"];
  }

  const paths = new Set<string>();
  for (const field of BOTTLE_REFERENCE_EVIDENCE_FIELDS) {
    const value = source.input.reference[field];
    if (value !== null && value !== undefined) {
      paths.add(`reference.${field}`);
    }
  }
  for (const [field, value] of Object.entries(
    source.artifacts.extractedIdentity ?? {},
  )) {
    if (value !== null && value !== undefined) {
      paths.add(`extractedIdentity.${field}`);
    }
  }
  for (const field of Object.keys(
    source.artifacts.imageEvidence?.fieldCandidates ?? {},
  )) {
    paths.add(`imageEvidence.fieldCandidates.${field}`);
  }
  return [...paths];
}

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

export const AuditBottleResultSchema = z
  .object({
    summary: z.string().trim().min(1),
    proposedOperations: ProposedOperationsSchema.default([]),
    findings: z.array(FindingSchema).default([]),
    artifacts: BottleClassificationArtifactsSchema,
  })
  .strict();

export type BottleReference = z.infer<typeof BottleReferenceSchema>;
export type BottleClassificationArtifacts = z.infer<
  typeof BottleClassificationArtifactsSchema
>;
export type CandidateExpansionMode = z.infer<
  typeof CandidateExpansionModeSchema
>;
export type ClassifyBottleReferenceInput = {
  reference: BottleReference;
  conversationId?: string;
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
export type AuditBottleResult = z.infer<typeof AuditBottleResultSchema>;

export function buildBottleClassificationArtifacts(
  artifacts: Partial<BottleClassificationArtifacts>,
): BottleClassificationArtifacts {
  return BottleClassificationArtifactsSchema.parse({
    extractedIdentity: null,
    imageEvidence: null,
    candidates: [],
    searchEvidence: [],
    resolvedEntities: [],
    bottleContexts: [],
    entityContexts: [],
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

export function createAuditBottleResult({
  summary,
  proposedOperations = [],
  findings = [],
  artifacts,
}: {
  summary: string;
  proposedOperations?: ProposedOperation[];
  findings?: Finding[];
  artifacts: Partial<BottleClassificationArtifacts>;
}): AuditBottleResult {
  return AuditBottleResultSchema.parse({
    summary,
    proposedOperations,
    findings,
    artifacts: buildBottleClassificationArtifacts(artifacts),
  });
}

export function isIgnoredBottleClassification(
  classification: BottleClassificationResult,
): classification is IgnoredBottleClassificationResult {
  return classification.status === "ignored";
}
