import { z } from "zod";

export const CatalogVerificationCreationSourceEnum = z.enum([
  "manual_entry",
  "bottle_classifier",
  "price_match_review",
  "price_match_automation",
  "repair_workflow",
]);

export type CatalogVerificationCreationSource = z.infer<
  typeof CatalogVerificationCreationSourceEnum
>;

export const CatalogVerificationWorkstreamEnum = z.enum([
  "brand-repairs",
  "entity-audits",
]);

export type CatalogVerificationWorkstream = z.infer<
  typeof CatalogVerificationWorkstreamEnum
>;

export const CatalogVerificationFindingKindEnum = z.enum([
  "brand_repair_candidate",
  "entity_audit_candidate",
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

const HistoricalCatalogVerificationFindingSchema = z
  .object({
    kind: z.literal("canon_repair_candidate"),
    summary: z.string().min(1),
    details: z.string().nullable().default(null),
    workstream: z.literal("canon-repairs"),
  })
  .strict();

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

const ActiveCatalogVerificationResultSchema = z
  .object({
    phase: z.literal("result"),
    source: CatalogVerificationCreationSourceEnum,
    status: CatalogVerificationStatusEnum,
    reason: z.string().nullable().default(null),
    findings: z.array(CatalogVerificationFindingSchema).default([]),
  })
  .strict();

export type CatalogVerificationResult = z.infer<
  typeof ActiveCatalogVerificationResultSchema
>;

export const CatalogVerificationResultSchema =
  ActiveCatalogVerificationResultSchema.extend({
    findings: z
      .array(
        z.union([
          CatalogVerificationFindingSchema,
          HistoricalCatalogVerificationFindingSchema,
        ]),
      )
      .default([]),
  });

export type PersistedCatalogVerificationResult = z.infer<
  typeof CatalogVerificationResultSchema
>;

type CatalogVerificationPolicyInput = {
  objectType: "bottle" | "entity";
  source: CatalogVerificationCreationSource;
};

export function shouldRunCatalogVerification({
  objectType,
  source,
}: CatalogVerificationPolicyInput) {
  return (
    source === "manual_entry" ||
    (objectType === "entity" && source === "price_match_automation")
  );
}

export function getCatalogVerificationSkipReason(
  input: CatalogVerificationPolicyInput,
) {
  if (shouldRunCatalogVerification(input)) {
    return null;
  }

  const { source } = input;
  switch (source) {
    case "bottle_classifier":
      return "Created through the reviewed bottle classifier flow.";
    case "price_match_review":
      return "Created through the moderator-reviewed price match workflow.";
    case "price_match_automation":
      return "Bottle details were already checked before automatic price matching created it.";
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
  return ActiveCatalogVerificationResultSchema.parse({
    phase: "result",
    ...input,
  });
}
