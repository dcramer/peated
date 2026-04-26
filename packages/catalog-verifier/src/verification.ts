import { z } from "zod";

export const CatalogVerificationCreationSourceEnum = z.enum([
  "manual_entry",
  "bottle_classifier",
  "price_match_review",
  "repair_workflow",
]);

export type CatalogVerificationCreationSource = z.infer<
  typeof CatalogVerificationCreationSourceEnum
>;

export const CatalogVerificationWorkstreamEnum = z.enum([
  "age-repairs",
  "brand-repairs",
  "canon-repairs",
  "entity-audits",
  "release-repairs",
]);

export type CatalogVerificationWorkstream = z.infer<
  typeof CatalogVerificationWorkstreamEnum
>;

export const CatalogVerificationFindingKindEnum = z.enum([
  "age_repair_candidate",
  "brand_repair_candidate",
  "canon_repair_candidate",
  "entity_audit_candidate",
  "release_repair_candidate",
]);

export const CatalogVerificationFindingSchema = z
  .object({
    kind: CatalogVerificationFindingKindEnum,
    summary: z.string().min(1),
    details: z.string().nullable().default(null),
    workstream: CatalogVerificationWorkstreamEnum,
  })
  .strict();

export type CatalogVerificationFinding = z.infer<
  typeof CatalogVerificationFindingSchema
>;

export const CatalogVerificationCreationMetadataSchema = z
  .object({
    phase: z.literal("creation"),
    creationSource: CatalogVerificationCreationSourceEnum,
  })
  .strict();

export type CatalogVerificationCreationMetadata = z.infer<
  typeof CatalogVerificationCreationMetadataSchema
>;

export const CatalogVerificationStatusEnum = z.enum([
  "flagged",
  "passed",
  "skipped",
]);

export type CatalogVerificationStatus = z.infer<
  typeof CatalogVerificationStatusEnum
>;

export const CatalogVerificationResultSchema = z
  .object({
    phase: z.literal("result"),
    source: CatalogVerificationCreationSourceEnum,
    status: CatalogVerificationStatusEnum,
    reason: z.string().nullable().default(null),
    findings: z.array(CatalogVerificationFindingSchema).default([]),
  })
  .strict();

export type CatalogVerificationResult = z.infer<
  typeof CatalogVerificationResultSchema
>;

export function shouldRunCatalogVerification(
  source: CatalogVerificationCreationSource,
) {
  return source === "manual_entry";
}

export function getCatalogVerificationSkipReason(
  source: CatalogVerificationCreationSource,
) {
  switch (source) {
    case "bottle_classifier":
      return "Created through the reviewed bottle classifier flow.";
    case "price_match_review":
      return "Created through the moderator-reviewed price match workflow.";
    case "repair_workflow":
      return "Created through a dedicated repair workflow.";
    case "manual_entry":
      return null;
  }
}

export function buildCatalogVerificationCreationMetadata(
  creationSource: CatalogVerificationCreationSource,
): CatalogVerificationCreationMetadata {
  return CatalogVerificationCreationMetadataSchema.parse({
    phase: "creation",
    creationSource,
  });
}

export function buildCatalogVerificationResult(
  input: Omit<CatalogVerificationResult, "phase">,
): CatalogVerificationResult {
  return CatalogVerificationResultSchema.parse({
    phase: "result",
    ...input,
  });
}
