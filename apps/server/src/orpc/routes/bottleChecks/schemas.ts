import {
  EvidenceRefSchema,
  ProposedOperationSchema,
} from "@peated/bottle-classifier";
import type { BottleCheckWithOperations } from "@peated/server/lib/bottleChecks";
import {
  BottleOperationActionResultSchema,
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
    resolvedEvidenceRefs: z.array(EvidenceRefSchema).nullable(),
    stateToken: JsonObjectSchema.nullable(),
    preparationError: JsonObjectSchema.nullable(),
    status: BottleOperationStatusSchema,
    reviewedById: z.number().nullable(),
    reviewedAt: DateTimeSchema.nullable(),
    rejectionReason: z
      .enum([
        "wrong_target",
        "wrong_change",
        "insufficient_evidence",
        "resolved_manually",
        "other",
      ])
      .nullable(),
    reviewerNote: z.string().nullable(),
    result: JsonObjectSchema.nullable(),
    error: z.string().nullable(),
    preparedAt: DateTimeSchema.nullable(),
    executionStartedAt: DateTimeSchema.nullable(),
    executionCompletedAt: DateTimeSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .strict();

export const BottleCheckResponseSchema = z
  .object({
    id: z.number(),
    intent: z.enum(["resolve_reference", "audit_bottle"]),
    origin: z.enum(["moderator", "post_user_creation"]).nullable(),
    sourceKind: z.string().nullable(),
    sourceId: z.string().nullable(),
    bottleId: z.number().nullable(),
    subjectKey: z.string(),
    backgroundEventKey: z.string().nullable(),
    schemaVersion: z.number(),
    inputSnapshot: JsonObjectSchema,
    output: JsonObjectSchema.nullable(),
    artifacts: JsonObjectSchema.nullable(),
    model: z.string().nullable(),
    modelMetadata: JsonObjectSchema.nullable(),
    error: z.string().nullable(),
    storePriceMatchProposalId: z.number().nullable(),
    storePriceMatchAttemptId: z.number().nullable(),
    closedById: z.number().nullable(),
    closeReason: z.enum(["dismissed", "resolved_manually"]).nullable(),
    closeNote: z.string().nullable(),
    createdAt: DateTimeSchema,
    completedAt: DateTimeSchema.nullable(),
    closedAt: DateTimeSchema.nullable(),
    operations: z.array(BottleOperationResponseSchema),
  })
  .strict();

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
        })
        .strict(),
    ),
  })
  .strict();

function serializeDate(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function serializeBottleCheck(check: BottleCheckWithOperations) {
  return BottleCheckResponseSchema.parse({
    ...check,
    createdAt: check.createdAt.toISOString(),
    completedAt: serializeDate(check.completedAt),
    closedAt: serializeDate(check.closedAt),
    operations: check.operations.map((operation) => ({
      ...operation,
      reviewedAt: serializeDate(operation.reviewedAt),
      preparedAt: serializeDate(operation.preparedAt),
      executionStartedAt: serializeDate(operation.executionStartedAt),
      executionCompletedAt: serializeDate(operation.executionCompletedAt),
      createdAt: operation.createdAt.toISOString(),
      updatedAt: operation.updatedAt.toISOString(),
    })),
  });
}
