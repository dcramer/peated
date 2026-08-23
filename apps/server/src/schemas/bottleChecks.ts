import {
  AuditBottleOriginSchema,
  BottleCheckIntentSchema,
  BottleClassifierRunMetadataSchema,
  ProposedOperationSchema,
} from "@peated/bottle-classifier";
import {
  BottleCheckCloseReasonSchema,
  PersistedAuditBottleCheckOutputSchema,
  PersistedReferenceBottleCheckOutputSchema,
} from "@peated/server/lib/bottleChecks";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleCheckSchemaVersion";
import {
  BottleOperationActionResultSchema,
  BottleOperationRejectionReasonSchema,
  BottleOperationStatusSchema,
} from "@peated/server/lib/bottleOperationModeration";
import {
  BlockedReviewOperationSchema,
  PreparationErrorSchema,
  ReviewBottleMergeSchema,
  ReviewBottleUpdateSchema,
  ReviewEntityMergeSchema,
  ReviewEntityUpdateSchema,
} from "@peated/server/lib/bottleOperationReviewSchemas";
import { BottleOperationFieldPathSchema } from "@peated/server/schemas/bottleOperationFields";
import { PersistedBottleOperationExecutionResultSchema } from "@peated/server/schemas/bottleOperationResults";
import { z } from "zod";

const DateTimeSchema = z.string().datetime();

export const BottleOperationResponseSchema = z
  .object({
    id: z.number(),
    checkId: z.number(),
    proposal: ProposedOperationSchema,
    excludedFields: z.array(BottleOperationFieldPathSchema),
    preparationError: PreparationErrorSchema.nullable(),
    status: BottleOperationStatusSchema,
    reviewedById: z.number().nullable(),
    reviewedAt: DateTimeSchema.nullable(),
    rejectionReason: BottleOperationRejectionReasonSchema.nullable(),
    reviewerNote: z.string().nullable(),
    result: PersistedBottleOperationExecutionResultSchema.nullable(),
    error: z.string().nullable(),
    executionStartedAt: DateTimeSchema.nullable(),
    executionCompletedAt: DateTimeSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .strict();

const CommonBottleCheckResponseFields = {
  id: z.number(),
  model: z.string().nullable(),
  modelMetadata: BottleClassifierRunMetadataSchema.nullable(),
  error: z.string().nullable(),
  storePriceMatchProposalId: z.number().nullable(),
  storePriceMatchAttemptId: z.number().nullable(),
  closedById: z.number().nullable(),
  closeReason: BottleCheckCloseReasonSchema.nullable(),
  closeNote: z.string().nullable(),
  createdAt: DateTimeSchema,
  completedAt: DateTimeSchema.nullable(),
  closedAt: DateTimeSchema.nullable(),
} as const;

const SupportedBottleCheckResponseFields = {
  ...CommonBottleCheckResponseFields,
  schemaSupported: z.literal(true),
  schemaVersion: z.literal(BOTTLE_CHECK_SCHEMA_VERSION),
  operations: z.array(BottleOperationResponseSchema),
} as const;

const SupportedAuditBottleCheckResponseSchema = z
  .object({
    ...SupportedBottleCheckResponseFields,
    intent: z.literal(BottleCheckIntentSchema.enum.audit_bottle),
    origin: AuditBottleOriginSchema,
    sourceKind: z.null(),
    sourceId: z.null(),
    bottleId: z.number().nullable(),
    output: PersistedAuditBottleCheckOutputSchema,
  })
  .strict();

const SupportedReferenceBottleCheckResponseSchema = z
  .object({
    ...SupportedBottleCheckResponseFields,
    intent: z.literal(BottleCheckIntentSchema.enum.resolve_reference),
    origin: z.null(),
    sourceKind: z.string(),
    sourceId: z.string(),
    bottleId: z.null(),
    output: PersistedReferenceBottleCheckOutputSchema,
  })
  .strict();

const SupportedBottleCheckResponseSchema = z.discriminatedUnion("intent", [
  SupportedAuditBottleCheckResponseSchema,
  SupportedReferenceBottleCheckResponseSchema,
]);

const UnsupportedBottleCheckResponseSchema = z
  .object({
    ...CommonBottleCheckResponseFields,
    intent: BottleCheckIntentSchema,
    origin: AuditBottleOriginSchema.nullable(),
    sourceKind: z.string().nullable(),
    sourceId: z.string().nullable(),
    bottleId: z.number().nullable(),
    schemaSupported: z.literal(false),
    schemaVersion: z
      .number()
      .int()
      .refine((value) => value !== BOTTLE_CHECK_SCHEMA_VERSION),
    canClose: z.boolean(),
    operationCount: z.number().int().nonnegative(),
    operations: z.tuple([]),
  })
  .strict();

export const BottleCheckResponseSchema = z.union([
  SupportedBottleCheckResponseSchema,
  UnsupportedBottleCheckResponseSchema,
]);

export const ModeratorBottleAuditResponseSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({
        status: z.literal("clean"),
        summary: z.string().trim().min(1),
      })
      .strict(),
    z
      .object({
        status: z.literal("needs_review"),
        audit: BottleCheckResponseSchema,
      })
      .strict(),
  ],
);

const PreparedReviewOperationResponseSchema = z.discriminatedUnion("type", [
  ReviewBottleUpdateSchema.omit({ stateToken: true }),
  ReviewBottleMergeSchema.omit({ stateToken: true }),
  ReviewEntityUpdateSchema.omit({ stateToken: true }),
  ReviewEntityMergeSchema.omit({ stateToken: true }),
]);

export const ReviewOperationResponseSchema = z.union([
  BlockedReviewOperationSchema,
  PreparedReviewOperationResponseSchema,
]);

export const BottleOperationActionResponseSchema = z
  .object({
    results: z.array(BottleOperationActionResultSchema),
  })
  .strict();

export const AuditDetailsResponseSchema = z
  .object({
    audit: BottleCheckResponseSchema,
    reviewOperations: z.array(
      z
        .object({
          operationId: z.number().int().positive(),
          review: ReviewOperationResponseSchema.nullable(),
          approvalReady: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
