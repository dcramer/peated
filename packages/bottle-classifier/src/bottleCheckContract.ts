import { z } from "zod";

import { EntityTypeEnum, ProposedBottleSchema } from "./classifierTypes";

const CURRENT_YEAR = new Date().getFullYear();
const PositiveIdSchema = z.number().int().positive();
const NonEmptyTextSchema = z.string().trim().min(1);
const NullableNonEmptyTextSchema = NonEmptyTextSchema.nullable();
const WebUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Expected an HTTP or HTTPS URL",
  });

function requireAtLeastOneField(
  value: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: "custom",
      message: "At least one field is required",
    });
  }
}

export const BottleCheckIntentSchema = z.enum([
  "resolve_reference",
  "audit_bottle",
]);

export const AuditBottleOriginSchema = z.enum([
  "moderator",
  "post_user_creation",
]);

export const AuditBottleInputSchema = z
  .object({
    bottleId: PositiveIdSchema,
    origin: AuditBottleOriginSchema,
    note: NonEmptyTextSchema.optional(),
  })
  .strict();

export const EvidenceRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("source"),
      field: NonEmptyTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("bottle"),
      bottleId: PositiveIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("entity"),
      entityId: PositiveIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("web_result"),
      url: WebUrlSchema,
    })
    .strict(),
]);

export const FindingSchema = z
  .object({
    scope: z.enum(["bottle", "bottle_group", "series", "entity", "other"]),
    summary: NonEmptyTextSchema,
    evidenceRefs: z.array(EvidenceRefSchema).nonempty(),
  })
  .strict();

export const ProposedEntityDraftSchema = z
  .object({
    name: NonEmptyTextSchema,
    roles: z.array(EntityTypeEnum).nonempty(),
    shortName: NullableNonEmptyTextSchema.optional(),
    website: WebUrlSchema.nullable().optional(),
    country: NullableNonEmptyTextSchema.optional(),
    region: NullableNonEmptyTextSchema.optional(),
    yearEstablished: z.number().int().lte(CURRENT_YEAR).nullable().optional(),
  })
  .strict();

export const ProposedEntityChoiceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("existing"),
      entityId: PositiveIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("create"),
      entity: ProposedEntityDraftSchema,
    })
    .strict(),
]);

export const BottleSharedPatchSchema = z
  .object({
    name: ProposedBottleSchema.shape.name.optional(),
    statedAge: ProposedBottleSchema.shape.statedAge.removeDefault().optional(),
    category: ProposedBottleSchema.shape.category.removeDefault().optional(),
    seriesId: PositiveIdSchema.nullable().optional(),
    brand: ProposedEntityChoiceSchema.optional(),
    distillers: z.array(ProposedEntityChoiceSchema).optional(),
    bottler: ProposedEntityChoiceSchema.nullable().optional(),
  })
  .strict()
  .superRefine(requireAtLeastOneField);

export const BottleExactPatchSchema = z
  .object({
    edition: ProposedBottleSchema.shape.edition.removeDefault().optional(),
    statedAge: ProposedBottleSchema.shape.statedAge.removeDefault().optional(),
    abv: ProposedBottleSchema.shape.abv.removeDefault().optional(),
    singleCask: ProposedBottleSchema.shape.singleCask
      .removeDefault()
      .optional(),
    caskStrength: ProposedBottleSchema.shape.caskStrength
      .removeDefault()
      .optional(),
    vintageYear: ProposedBottleSchema.shape.vintageYear
      .removeDefault()
      .optional(),
    releaseYear: ProposedBottleSchema.shape.releaseYear
      .removeDefault()
      .optional(),
    caskSize: ProposedBottleSchema.shape.caskSize.removeDefault().optional(),
    caskType: ProposedBottleSchema.shape.caskType.removeDefault().optional(),
    caskFill: ProposedBottleSchema.shape.caskFill.removeDefault().optional(),
  })
  .strict()
  .superRefine(requireAtLeastOneField);

export const BottleUpdatePatchSchema = z
  .object({
    shared: BottleSharedPatchSchema.optional(),
    exact: BottleExactPatchSchema.optional(),
  })
  .strict()
  .superRefine(requireAtLeastOneField);

export const EntityIdentityPatchSchema = z
  .object({
    name: NonEmptyTextSchema.optional(),
    shortName: NullableNonEmptyTextSchema.optional(),
    roles: z.array(EntityTypeEnum).nonempty().optional(),
    website: WebUrlSchema.nullable().optional(),
    country: NullableNonEmptyTextSchema.optional(),
    region: NullableNonEmptyTextSchema.optional(),
    yearEstablished: z.number().int().lte(CURRENT_YEAR).nullable().optional(),
  })
  .strict()
  .superRefine(requireAtLeastOneField);

const ProposedOperationEnvelope = {
  rationale: NonEmptyTextSchema,
  evidenceRefs: z.array(EvidenceRefSchema).nonempty(),
} as const;

export const ProposedOperationTypeSchema = z.enum([
  "update_bottle",
  "merge_bottles",
  "update_entity",
  "merge_entities",
]);

export const PROPOSED_OPERATION_TYPES = ProposedOperationTypeSchema.options;

export const UpdateBottleOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.update_bottle),
    input: z
      .object({
        bottleId: PositiveIdSchema,
        patch: BottleUpdatePatchSchema,
      })
      .strict(),
    ...ProposedOperationEnvelope,
  })
  .strict();

export const MergeBottlesOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.merge_bottles),
    input: z
      .object({
        sourceBottleId: PositiveIdSchema,
        destinationBottleId: PositiveIdSchema,
      })
      .strict()
      .refine(
        ({ sourceBottleId, destinationBottleId }) =>
          sourceBottleId !== destinationBottleId,
        {
          message: "Source and destination Bottles must be different",
        },
      ),
    ...ProposedOperationEnvelope,
  })
  .strict();

export const UpdateEntityOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.update_entity),
    input: z
      .object({
        entityId: PositiveIdSchema,
        patch: EntityIdentityPatchSchema,
      })
      .strict(),
    ...ProposedOperationEnvelope,
  })
  .strict();

export const MergeEntitiesOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.merge_entities),
    input: z
      .object({
        sourceEntityId: PositiveIdSchema,
        destinationEntityId: PositiveIdSchema,
      })
      .strict()
      .refine(
        ({ sourceEntityId, destinationEntityId }) =>
          sourceEntityId !== destinationEntityId,
        {
          message: "Source and destination Entities must be different",
        },
      ),
    ...ProposedOperationEnvelope,
  })
  .strict();

export const ProposedOperationSchema = z.discriminatedUnion("type", [
  UpdateBottleOperationSchema,
  MergeBottlesOperationSchema,
  UpdateEntityOperationSchema,
  MergeEntitiesOperationSchema,
]);

export const DEFAULT_MAX_PROPOSED_OPERATIONS = 25;

export function createProposedOperationsSchema(
  maxOperations = DEFAULT_MAX_PROPOSED_OPERATIONS,
) {
  if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) {
    throw new RangeError("maxOperations must be a positive safe integer");
  }

  return z.array(ProposedOperationSchema).max(maxOperations);
}

export const ProposedOperationsSchema = createProposedOperationsSchema();

export type BottleCheckIntent = z.infer<typeof BottleCheckIntentSchema>;
export type AuditBottleOrigin = z.infer<typeof AuditBottleOriginSchema>;
export type AuditBottleInput = z.infer<typeof AuditBottleInputSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ProposedEntityDraft = z.infer<typeof ProposedEntityDraftSchema>;
export type ProposedEntityChoice = z.infer<typeof ProposedEntityChoiceSchema>;
export type BottleSharedPatch = z.infer<typeof BottleSharedPatchSchema>;
export type BottleExactPatch = z.infer<typeof BottleExactPatchSchema>;
export type BottleUpdatePatch = z.infer<typeof BottleUpdatePatchSchema>;
export type EntityIdentityPatch = z.infer<typeof EntityIdentityPatchSchema>;
export type ProposedOperationType = z.infer<typeof ProposedOperationTypeSchema>;
export type UpdateBottleOperation = z.infer<typeof UpdateBottleOperationSchema>;
export type MergeBottlesOperation = z.infer<typeof MergeBottlesOperationSchema>;
export type UpdateEntityOperation = z.infer<typeof UpdateEntityOperationSchema>;
export type MergeEntitiesOperation = z.infer<
  typeof MergeEntitiesOperationSchema
>;
export type ProposedOperation = z.infer<typeof ProposedOperationSchema>;
