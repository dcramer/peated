import type { BottleCheckWithOperations } from "@peated/server/lib/bottleChecks";
import { isSupportedBottleCheckSchemaVersion } from "@peated/server/lib/bottleCheckSchemaVersion";
import type { ReviewOperation } from "@peated/server/lib/bottleOperationReviewSchemas";
import {
  BottleCheckResponseSchema,
  BottleOperationResponseSchema,
  ReviewOperationResponseSchema,
} from "@peated/server/schemas/bottleChecks";
import type { z } from "zod";

export function serializeReviewOperation(
  review: ReviewOperation | null,
): z.infer<typeof ReviewOperationResponseSchema> | null {
  if (!review || review.status === "blocked") return review;
  const { stateToken: _stateToken, ...response } = review;
  return ReviewOperationResponseSchema.parse(response);
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
    return BottleCheckResponseSchema.parse({
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

  return BottleCheckResponseSchema.parse({
    ...common,
    schemaSupported: true,
    schemaVersion: check.schemaVersion,
    output: check.output,
    operations: check.operations.map(serializeBottleOperation),
  });
}
