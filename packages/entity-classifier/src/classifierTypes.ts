import { z } from "zod";

export const EntityTypeEnum = z.enum(["brand", "bottler", "distiller"]);

export const EntityClassificationReasonKindEnum = z.enum([
  "brand_repair_group",
  "generic_name",
  "name_suffix_conflict",
  "metadata_conflict",
  "manual_audit",
]);

export const EntityClassificationReasonSchema = z
  .object({
    kind: EntityClassificationReasonKindEnum,
    summary: z.string().trim().min(1),
    details: z.string().trim().nullable().default(null),
  })
  .strict();

export const EntityClassificationSampleBottleSchema = z
  .object({
    id: z.number().int(),
    fullName: z.string().trim().min(1),
    name: z.string().trim().min(1),
    category: z.string().trim().nullable().default(null),
    totalTastings: z.number().int().nullable().default(null),
  })
  .strict();

export const EntityClassificationCandidateTargetSourceEnum = z.enum([
  "grouped_brand_repair",
  "name_suffix_sibling",
]);

export const EntityClassificationCandidateTargetSchema = z
  .object({
    entityId: z.number().int(),
    name: z.string().trim().min(1),
    shortName: z.string().trim().nullable().default(null),
    aliases: z.array(z.string().trim().min(1)).default([]),
    type: z.array(EntityTypeEnum).default([]),
    website: z.string().trim().nullable().default(null),
    score: z.number().nullable().default(null),
    candidateCount: z.number().int().min(0).default(0),
    totalTastings: z.number().int().min(0).default(0),
    supportingBottleIds: z.array(z.number().int()).default([]),
    reason: z.string().trim().min(1),
    source: z.array(EntityClassificationCandidateTargetSourceEnum).default([]),
  })
  .strict();

export const EntityClassificationSubjectSchema = z
  .object({
    id: z.number().int(),
    name: z.string().trim().min(1),
    shortName: z.string().trim().nullable().default(null),
    aliases: z.array(z.string().trim().min(1)).default([]),
    type: z.array(EntityTypeEnum).default([]),
    website: z.string().trim().nullable().default(null),
    countryName: z.string().trim().nullable().default(null),
    regionName: z.string().trim().nullable().default(null),
    totalBottles: z.number().int().min(0).default(0),
    totalTastings: z.number().int().min(0).default(0),
  })
  .strict();

export const EntityClassificationReferenceSchema = z
  .object({
    entity: EntityClassificationSubjectSchema,
    reasons: z.array(EntityClassificationReasonSchema).default([]),
    sampleBottles: z.array(EntityClassificationSampleBottleSchema).default([]),
    candidateTargets: z
      .array(EntityClassificationCandidateTargetSchema)
      .default([]),
  })
  .strict();

export const SearchEntitiesArgsSchema = z
  .object({
    query: z.string().trim().min(1),
    type: EntityTypeEnum.nullable().default(null),
    limit: z.number().int().min(1).max(25).default(10),
  })
  .strict();

export const EntityResolutionSchema = z
  .object({
    entityId: z.number().int(),
    name: z.string().trim().min(1),
    shortName: z.string().trim().nullable().default(null),
    type: z.array(EntityTypeEnum).default([]),
    alias: z.string().trim().nullable().default(null),
    score: z.number().nullable().default(null),
    source: z.array(z.enum(["exact", "text", "prefix"])).default([]),
  })
  .strict();

export const EntityClassificationSearchEvidenceResultSchema = z
  .object({
    title: z.string().trim().min(1),
    url: z.string().url(),
    domain: z.string().trim().min(1),
    description: z.string().trim().nullable().default(null),
  })
  .strict();

export const EntityClassificationSearchEvidenceSchema = z
  .object({
    provider: z.literal("openai"),
    query: z.string().trim().min(1),
    summary: z.string().trim().nullable().default(null),
    results: z
      .array(EntityClassificationSearchEvidenceResultSchema)
      .default([]),
  })
  .strict();

export const EntityClassificationAdviceKindEnum = z.enum([
  "brand_assignment_issue",
  "metadata_issue",
  "possible_duplicate",
  "generic_or_invalid",
  "insufficient_evidence",
  "no_issue",
]);

// Entity Classification is advice only. Bottle Review owns agent-proposed
// Entity changes, and the server owns validated Review Operations.
export const EntityClassificationAdviceSchema = z
  .object({
    kind: EntityClassificationAdviceKindEnum,
    summary: z.string().trim().min(1),
    targetEntityId: z.number().int().nullable().default(null),
    evidenceUrls: z.array(z.string().url()).default([]),
  })
  .strict();

export type EntityClassificationReason = z.infer<
  typeof EntityClassificationReasonSchema
>;
export type EntityClassificationSampleBottle = z.infer<
  typeof EntityClassificationSampleBottleSchema
>;
export type EntityClassificationCandidateTarget = z.infer<
  typeof EntityClassificationCandidateTargetSchema
>;
export type EntityClassificationSubject = z.infer<
  typeof EntityClassificationSubjectSchema
>;
export type EntityClassificationReference = z.infer<
  typeof EntityClassificationReferenceSchema
>;
export type SearchEntitiesArgs = z.infer<typeof SearchEntitiesArgsSchema>;
export type EntityResolution = z.infer<typeof EntityResolutionSchema>;
export type EntityClassificationSearchEvidence = z.infer<
  typeof EntityClassificationSearchEvidenceSchema
>;
export type EntityClassificationAdvice = z.infer<
  typeof EntityClassificationAdviceSchema
>;
