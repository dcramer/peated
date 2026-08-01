import {
  AuditBottleOriginSchema,
  BottleCheckIntentSchema,
  ProposedOperationSchema,
} from "@peated/bottle-classifier";
import {
  BottleCheckCloseReasonSchema,
  PersistedAuditBottleCheckOutputSchema,
  PersistedReferenceBottleCheckOutputSchema,
  type BottleCheckWithOperations,
} from "@peated/server/lib/bottleChecks";
import {
  BOTTLE_CHECK_SCHEMA_VERSION,
  isSupportedBottleCheckSchemaVersion,
} from "@peated/server/lib/bottleCheckSchemaVersion";
import {
  BottleOperationActionResultSchema,
  BottleOperationRejectionReasonSchema,
  BottleOperationStatusSchema,
} from "@peated/server/lib/bottleOperationModeration";
import {
  BlockedReviewOperationSchema,
  ReviewBottleMergeSchema,
  ReviewBottleUpdateSchema,
  ReviewEntityMergeSchema,
  ReviewEntityUpdateSchema,
  type ReviewOperation,
} from "@peated/server/lib/bottleOperationReviewSchemas";
import { z } from "zod";

const JsonObjectSchema = z.record(z.string(), z.unknown());
const DateTimeSchema = z.string().datetime();

export const BottleOperationResponseSchema = z
  .object({
    id: z.number(),
    checkId: z.number(),
    proposal: ProposedOperationSchema,
    preparationError: JsonObjectSchema.nullable(),
    status: BottleOperationStatusSchema,
    reviewedById: z.number().nullable(),
    reviewedAt: DateTimeSchema.nullable(),
    rejectionReason: BottleOperationRejectionReasonSchema.nullable(),
    reviewerNote: z.string().nullable(),
    result: JsonObjectSchema.nullable(),
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
      .refine((value) => {
        return value !== BOTTLE_CHECK_SCHEMA_VERSION;
      }),
    canClose: z.boolean(),
    operationCount: z.number().int().nonnegative(),
    operations: z.tuple([]),
  })
  .strict();

export const BottleCheckResponseSchema = z.union([
  SupportedBottleCheckResponseSchema,
  UnsupportedBottleCheckResponseSchema,
]);

const PreparedReviewOperationResponseSchema = z.discriminatedUnion("type", [
  ReviewBottleUpdateSchema.omit({ stateToken: true }),
  ReviewBottleMergeSchema.omit({ stateToken: true }),
  ReviewEntityUpdateSchema.omit({ stateToken: true }),
  ReviewEntityMergeSchema.omit({ stateToken: true }),
]);

const ReviewOperationResponseSchema = z.union([
  BlockedReviewOperationSchema,
  PreparedReviewOperationResponseSchema,
]);

export const BottleOperationActionResponseSchema = z
  .object({
    results: z.array(BottleOperationActionResultSchema),
  })
  .strict();

export const BottleCheckDetailsResponseSchema = z
  .object({
    check: BottleCheckResponseSchema,
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

export function serializeReviewOperation(
  review: ReviewOperation | null,
): z.infer<typeof ReviewOperationResponseSchema> | null {
  if (!review || review.status === "blocked") return review;
  const { stateToken: _stateToken, ...response } = review;
  return PreparedReviewOperationResponseSchema.parse(response);
}

function serializeDate(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function serializeBottleOperation(
  operation: BottleCheckWithOperations["operations"][number],
) {
  return BottleOperationResponseSchema.parse({
    id: operation.id,
    checkId: operation.checkId,
    proposal: operation.proposal,
    preparationError: operation.preparationError,
    status: operation.status,
    reviewedById: operation.reviewedById,
    reviewedAt: serializeDate(operation.reviewedAt),
    rejectionReason: operation.rejectionReason,
    reviewerNote: operation.reviewerNote,
    result: operation.result,
    error: operation.error,
    executionStartedAt: serializeDate(operation.executionStartedAt),
    executionCompletedAt: serializeDate(operation.executionCompletedAt),
    createdAt: operation.createdAt.toISOString(),
    updatedAt: operation.updatedAt.toISOString(),
  });
}

export function serializeBottleCheck(check: BottleCheckWithOperations) {
  const common = {
    id: check.id,
    intent: check.intent,
    origin: check.origin,
    sourceKind: check.sourceKind,
    sourceId: check.sourceId,
    bottleId: check.bottleId,
    model: check.model,
    error: check.error,
    storePriceMatchProposalId: check.storePriceMatchProposalId,
    storePriceMatchAttemptId: check.storePriceMatchAttemptId,
    closedById: check.closedById,
    closeReason: check.closeReason,
    closeNote: check.closeNote,
    createdAt: check.createdAt.toISOString(),
    completedAt: serializeDate(check.completedAt),
    closedAt: serializeDate(check.closedAt),
  };

  if (!isSupportedBottleCheckSchemaVersion(check)) {
    return UnsupportedBottleCheckResponseSchema.parse({
      ...common,
      schemaSupported: false,
      schemaVersion: check.schemaVersion,
      canClose:
        check.closedAt === null &&
        !check.operations.some(({ status }) => status === "applying"),
      operationCount: check.operations.length,
      operations: [],
    });
  }

  const output =
    check.intent === "audit_bottle"
      ? PersistedAuditBottleCheckOutputSchema.parse(check.output)
      : PersistedReferenceBottleCheckOutputSchema.parse(check.output);

  return SupportedBottleCheckResponseSchema.parse({
    ...common,
    schemaSupported: true,
    schemaVersion: check.schemaVersion,
    output,
    operations: check.operations.map(serializeBottleOperation),
  });
}
