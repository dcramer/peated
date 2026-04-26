import { z } from "zod";
import {
  EntityClassificationDecisionSchema,
  EntityClassificationReferenceSchema,
  EntityClassificationSearchEvidenceSchema,
  EntityResolutionSchema,
} from "./classifierTypes";

export const ClassifyEntityInputSchema = z
  .object({
    reference: EntityClassificationReferenceSchema,
  })
  .strict();

export const EntityClassificationArtifactsSchema = z
  .object({
    resolvedEntities: z.array(EntityResolutionSchema).default([]),
    searchEvidence: z
      .array(EntityClassificationSearchEvidenceSchema)
      .default([]),
  })
  .strict();

export const EntityClassificationResultSchema = z
  .object({
    decision: EntityClassificationDecisionSchema,
    artifacts: EntityClassificationArtifactsSchema,
  })
  .strict();

export type ClassifyEntityInput = z.infer<typeof ClassifyEntityInputSchema>;
export type EntityClassificationArtifacts = z.infer<
  typeof EntityClassificationArtifactsSchema
>;
export type EntityClassificationResult = z.infer<
  typeof EntityClassificationResultSchema
>;

export function buildEntityClassificationArtifacts(
  artifacts: Partial<EntityClassificationArtifacts>,
): EntityClassificationArtifacts {
  return EntityClassificationArtifactsSchema.parse({
    resolvedEntities: [],
    searchEvidence: [],
    ...artifacts,
  });
}
