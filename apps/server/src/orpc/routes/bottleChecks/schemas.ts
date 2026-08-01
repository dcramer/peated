import {
  AuditBottleOriginSchema,
  BottleCheckIntentSchema,
  ProposedOperationSchema,
} from "@peated/bottle-classifier";
import {
  BottleCheckCloseReasonSchema,
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
import { ReviewOperationSchema } from "@peated/server/lib/bottleOperationReviewSchemas";
import { z } from "zod";

const JsonObjectSchema = z.record(z.string(), z.unknown());
const DateTimeSchema = z.string().datetime();

export const BottleOperationResponseSchema = z
  .object({
    id: z.number(),
    checkId: z.number(),
    proposal: ProposedOperationSchema,
    stateToken: JsonObjectSchema.nullable(),
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

const BottleCheckResponseFields = {
  id: z.number(),
  intent: BottleCheckIntentSchema,
  origin: AuditBottleOriginSchema.nullable(),
  sourceKind: z.string().nullable(),
  sourceId: z.string().nullable(),
  bottleId: z.number().nullable(),
  subjectKey: z.string(),
  backgroundEventKey: z.string().nullable(),
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

const SupportedBottleCheckResponseSchema = z
  .object({
    ...BottleCheckResponseFields,
    schemaSupported: z.literal(true),
    schemaVersion: z.literal(BOTTLE_CHECK_SCHEMA_VERSION),
    inputSnapshot: JsonObjectSchema,
    output: JsonObjectSchema.nullable(),
    artifacts: JsonObjectSchema.nullable(),
    modelMetadata: JsonObjectSchema.nullable(),
    operations: z.array(BottleOperationResponseSchema),
  })
  .strict();

const UnsupportedBottleCheckResponseSchema = z
  .object({
    ...BottleCheckResponseFields,
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

export const BottleCheckResponseSchema = z.discriminatedUnion(
  "schemaSupported",
  [SupportedBottleCheckResponseSchema, UnsupportedBottleCheckResponseSchema],
);

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
          review: ReviewOperationSchema.nullable(),
          approvalReady: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

function serializeDate(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function serializeBottleCheck(check: BottleCheckWithOperations) {
  const common = {
    id: check.id,
    intent: check.intent,
    origin: check.origin,
    sourceKind: check.sourceKind,
    sourceId: check.sourceId,
    bottleId: check.bottleId,
    subjectKey: check.subjectKey,
    backgroundEventKey: check.backgroundEventKey,
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

  return SupportedBottleCheckResponseSchema.parse({
    ...common,
    schemaSupported: true,
    schemaVersion: check.schemaVersion,
    inputSnapshot: check.inputSnapshot,
    output: check.output,
    artifacts: check.artifacts,
    modelMetadata: check.modelMetadata,
    operations: check.operations.map((operation) => ({
      ...operation,
      reviewedAt: serializeDate(operation.reviewedAt),
      executionStartedAt: serializeDate(operation.executionStartedAt),
      executionCompletedAt: serializeDate(operation.executionCompletedAt),
      createdAt: operation.createdAt.toISOString(),
      updatedAt: operation.updatedAt.toISOString(),
    })),
  });
}
