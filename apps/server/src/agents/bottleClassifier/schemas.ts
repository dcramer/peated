import { ENTITY_TYPE_LIST } from "@peated/server/constants";
import {
  BottleCandidateSchema,
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
  BottleClassifierAgentResponseSchema,
  BottleReferenceIdentitySchema,
  BottleSearchEvidenceSchema,
} from "@peated/server/schemas";
import { z } from "zod";

export {
  BottleCandidateSchema,
  BottleClassifierAgentDecisionSchema,
  BottleClassifierAgentResponseSchema,
  BottleSearchEvidenceSchema,
};

export const BottleExtractedDetailsSchema = BottleReferenceIdentitySchema;
export const BottleMatchDecisionSchema = BottleClassificationDecisionSchema;
export const EntityResolutionSchema = z.object({
  entityId: z.number(),
  name: z.string(),
  shortName: z.string().nullable().default(null),
  type: z.array(z.enum(ENTITY_TYPE_LIST)).default([]),
  alias: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
});

export type BottleExtractedDetails = z.infer<
  typeof BottleExtractedDetailsSchema
>;
export type BottleCandidate = z.infer<typeof BottleCandidateSchema>;
export type BottleSearchEvidence = z.infer<typeof BottleSearchEvidenceSchema>;
export type BottleClassifierAgentDecision = z.infer<
  typeof BottleClassifierAgentDecisionSchema
>;
export type BottleMatchDecision = z.infer<typeof BottleMatchDecisionSchema>;
export type EntityResolution = z.infer<typeof EntityResolutionSchema>;
