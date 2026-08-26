import { z } from "zod";

import { EntityTypeEnum, ProposedBottleFields } from "./classifierTypes";

const CURRENT_YEAR = new Date().getFullYear();
const PositiveIdSchema = z.number().int().positive();
const NonEmptyTextSchema = z.string().trim().min(1);
const NullableNonEmptyTextSchema = NonEmptyTextSchema.nullable();
const WebUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Expected an HTTP or HTTPS URL",
  });

function requireAtLeastOneField<T extends object>(
  value: T,
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

export const SourceEvidencePathSchema = z.union([
  z.literal("audit.note"),
  z.string().regex(/^reference\.[A-Za-z_][A-Za-z0-9_]*$/),
  z.string().regex(/^extractedIdentity\.[A-Za-z_][A-Za-z0-9_]*$/),
  z.string().regex(/^imageEvidence\.fieldCandidates\.[A-Za-z_][A-Za-z0-9_]*$/),
]);

export const EvidenceRefSchema = z.union([
  z
    .object({
      kind: z.literal("source"),
      field: SourceEvidencePathSchema,
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
  .strict()
  .describe(
    "An unresolved catalog problem that still needs separate moderator attention after all Suggested Changes apply. Not an observation, confirmation, or correct unchanged state.",
  );

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

export const BottleOperationEntityChoiceSchema = z.union([
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

export const BottlePatchSchema = z
  .object({
    name: ProposedBottleFields.name.optional(),
    statedAge: ProposedBottleFields.statedAge.removeDefault().optional(),
    category: ProposedBottleFields.category.removeDefault().optional(),
    seriesId: PositiveIdSchema.nullable().optional(),
    brand: BottleOperationEntityChoiceSchema.optional(),
    distillers: z.array(BottleOperationEntityChoiceSchema).optional(),
    bottler: BottleOperationEntityChoiceSchema.nullable()
      .optional()
      .describe(
        "Market-facing bottler or release imprint. Clear an existing value only when product evidence shows it is wrong; omission or matching the Brand or a distiller is not enough.",
      ),
    edition: ProposedBottleFields.edition.removeDefault().optional(),
    abv: ProposedBottleFields.abv
      .removeDefault()
      .optional()
      .describe(
        "ABV for this Bottle. Change an existing value only with evidence for the same Bottle, not another batch or release.",
      ),
    singleCask: ProposedBottleFields.singleCask.removeDefault().optional(),
    caskStrength: ProposedBottleFields.caskStrength
      .removeDefault()
      .optional()
      .describe(
        "Whether this Bottle is marketed as cask strength, barrel proof, or barrel strength. A stored `null` may be filled from product evidence.",
      ),
    vintageYear: ProposedBottleFields.vintageYear.removeDefault().optional(),
    bottlingYear: ProposedBottleFields.bottlingYear,
    releaseYear: ProposedBottleFields.releaseYear.removeDefault().optional(),
    caskSize: ProposedBottleFields.caskSize.removeDefault().optional(),
    caskType: ProposedBottleFields.caskType.removeDefault().optional(),
    caskFill: ProposedBottleFields.caskFill.removeDefault().optional(),
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

export const ProposedOperationEnvelopeFields = {
  rationale: NonEmptyTextSchema,
  evidenceRefs: z.array(EvidenceRefSchema).nonempty(),
} as const;

export const ProposedOperationTypeSchema = z.enum([
  "update_bottle",
  "merge_bottles",
  "update_entity",
  "merge_entities",
]);

export const UpdateBottleOperationInputSchema = z
  .object({
    bottleId: PositiveIdSchema,
    patch: BottlePatchSchema,
  })
  .strict();

export const UpdateBottleOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.update_bottle),
    input: UpdateBottleOperationInputSchema,
    ...ProposedOperationEnvelopeFields,
  })
  .strict();

export const MergeBottlesOperationInputSchema = z
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
  );

export const MergeBottlesOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.merge_bottles),
    input: MergeBottlesOperationInputSchema,
    ...ProposedOperationEnvelopeFields,
  })
  .strict();

export const UpdateEntityOperationInputSchema = z
  .object({
    entityId: PositiveIdSchema,
    patch: EntityIdentityPatchSchema,
  })
  .strict();

export const UpdateEntityOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.update_entity),
    input: UpdateEntityOperationInputSchema,
    ...ProposedOperationEnvelopeFields,
  })
  .strict();

export const MergeEntitiesOperationInputSchema = z
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
  );

export const MergeEntitiesOperationSchema = z
  .object({
    type: z.literal(ProposedOperationTypeSchema.enum.merge_entities),
    input: MergeEntitiesOperationInputSchema,
    ...ProposedOperationEnvelopeFields,
  })
  .strict();

export const ProposedOperationSchema = z.union([
  UpdateBottleOperationSchema,
  MergeBottlesOperationSchema,
  UpdateEntityOperationSchema,
  MergeEntitiesOperationSchema,
]);

export const DEFAULT_MAX_PROPOSED_OPERATIONS = 25;

export const ProposedOperationsSchema = z
  .array(ProposedOperationSchema)
  .max(DEFAULT_MAX_PROPOSED_OPERATIONS);

export type BottleCheckIntent = z.infer<typeof BottleCheckIntentSchema>;
export type AuditBottleOrigin = z.infer<typeof AuditBottleOriginSchema>;
export type AuditBottleInput = z.infer<typeof AuditBottleInputSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ProposedEntityDraft = z.infer<typeof ProposedEntityDraftSchema>;
export type BottleOperationEntityChoice = z.infer<
  typeof BottleOperationEntityChoiceSchema
>;
export type BottlePatch = z.infer<typeof BottlePatchSchema>;
export type EntityIdentityPatch = z.infer<typeof EntityIdentityPatchSchema>;
export type ProposedOperationType = z.infer<typeof ProposedOperationTypeSchema>;
export type UpdateBottleOperation = z.infer<typeof UpdateBottleOperationSchema>;
export type MergeBottlesOperation = z.infer<typeof MergeBottlesOperationSchema>;
export type UpdateEntityOperation = z.infer<typeof UpdateEntityOperationSchema>;
export type MergeEntitiesOperation = z.infer<
  typeof MergeEntitiesOperationSchema
>;
export type ProposedOperation = z.infer<typeof ProposedOperationSchema>;
