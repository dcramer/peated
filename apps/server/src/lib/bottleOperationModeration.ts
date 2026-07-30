import {
  BottleClassificationArtifactsSchema,
  ProposedOperationSchema,
} from "@peated/bottle-classifier";
import config from "@peated/server/config";
import {
  db,
  type AnyConnection,
  type AnyDatabase,
  type AnyTransaction,
} from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  bottleTombstones,
  bottles,
  entities,
  entityTombstones,
  storePriceMatchProposals,
  users,
  type BottleCheck,
  type BottleOperation,
  type User,
} from "@peated/server/db/schema";
import type { BottleCheckOperationCapabilities } from "@peated/server/lib/bottleCheckAvailableOperations";
import {
  BottleOperationExecutionResultSchema,
  executePreparedOperationInTransaction,
} from "@peated/server/lib/bottleOperationExecution";
import {
  isOperationPreparationFailure,
  prepareOperation,
  prepareOperationForExecution,
  type BottleOperationExecutionPreparationContext,
  type BottleOperationPreparationContext,
  type PreparedOperationExecution,
} from "@peated/server/lib/bottleOperationReview";
import {
  BlockedReviewOperationSchema,
  PreparedReviewOperationSchema,
  type ReviewOperation,
} from "@peated/server/lib/bottleOperationReviewSchemas";
import { EntityMergeOperationExecutionResultSchema } from "@peated/server/lib/entityMergeOperation";
import { logError } from "@peated/server/lib/log";
import { and, eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

const PositiveIdSchema = z.number().int().positive();
const NonEmptyNoteSchema = z.string().trim().min(1).max(2000);
const MAX_SELECTED_OPERATIONS = 50;

export const BottleOperationRejectionReasonSchema = z.enum([
  "wrong_target",
  "wrong_change",
  "insufficient_evidence",
  "resolved_manually",
  "other",
]);

export const BottleOperationStatusSchema = z.enum([
  "blocked",
  "pending_review",
  "rejected",
  "applying",
  "applied",
  "stale",
  "failed",
]);

export const SelectedBottleOperationIdsSchema = z
  .array(PositiveIdSchema)
  .min(1)
  .max(MAX_SELECTED_OPERATIONS)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Operation ids must be unique.",
  });

export const ApproveBottleOperationsInputSchema = z
  .object({
    checkId: PositiveIdSchema,
    operationIds: SelectedBottleOperationIdsSchema,
  })
  .strict();

export const RejectBottleOperationsInputSchema = z
  .object({
    checkId: PositiveIdSchema,
    operationIds: SelectedBottleOperationIdsSchema,
    reason: BottleOperationRejectionReasonSchema,
    note: NonEmptyNoteSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.reason === "other" && input.note === undefined) {
      context.addIssue({
        code: "custom",
        message: "A note is required when the rejection reason is other.",
        path: ["note"],
      });
    }
  });

export const RetryBottleOperationInputSchema = z
  .object({
    checkId: PositiveIdSchema,
    operationId: PositiveIdSchema,
  })
  .strict();

export const BottleOperationActionResultSchema = z
  .object({
    operationId: PositiveIdSchema,
    status: BottleOperationStatusSchema.nullable(),
    error: z.string().nullable(),
  })
  .strict();

export type BottleOperationActionResult = z.infer<
  typeof BottleOperationActionResultSchema
>;

type LockedOperationContext = {
  check: BottleCheck;
  operation: BottleOperation;
};

type PreparedExecution = {
  operationId: number;
  status: "applied" | "applying";
  afterCommit: () => Promise<void>;
};

const OPERATION_CAPABILITIES = {
  update_bottle: true,
  merge_bottles: true,
  update_entity: true,
  merge_entities: true,
} as const satisfies BottleCheckOperationCapabilities;

const REJECTABLE_STATUSES = new Set<BottleOperation["status"]>([
  "blocked",
  "pending_review",
  "stale",
  "failed",
]);

export class BottleOperationModerationAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to review Bottle operations.");
    this.name = "BottleOperationModerationAuthorizationError";
  }
}

export class BottleOperationExecutionDisabledError extends Error {
  constructor() {
    super("Bottle operation execution is not enabled.");
    this.name = "BottleOperationExecutionDisabledError";
  }
}

class BottleOperationActionError extends Error {
  constructor(
    message: string,
    readonly status: BottleOperation["status"] | null = null,
  ) {
    super(message);
    this.name = "BottleOperationActionError";
  }
}

function assertModerator(user: User | null): asserts user is User {
  if (!user?.admin && !user?.mod) {
    throw new BottleOperationModerationAuthorizationError();
  }
}

function actionError(
  operationId: number,
  error: unknown,
): BottleOperationActionResult {
  return BottleOperationActionResultSchema.parse({
    operationId,
    status: error instanceof BottleOperationActionError ? error.status : null,
    error:
      error instanceof BottleOperationActionError
        ? error.message
        : "The Bottle operation could not be processed.",
  });
}

function actionResult(
  operationId: number,
  status: BottleOperation["status"],
): BottleOperationActionResult {
  return BottleOperationActionResultSchema.parse({
    operationId,
    status,
    error: null,
  });
}

async function loadLockedOperationContext({
  checkId,
  operationId,
  transaction,
}: {
  checkId: number;
  operationId: number;
  transaction: AnyTransaction;
}): Promise<LockedOperationContext> {
  const [operationReference] = await transaction
    .select({ checkId: bottleOperations.checkId })
    .from(bottleOperations)
    .where(eq(bottleOperations.id, operationId))
    .limit(1);
  if (!operationReference || operationReference.checkId !== checkId) {
    throw new BottleOperationActionError(
      `Bottle operation ${operationId} was not found in check ${checkId}.`,
    );
  }

  const [check] = await transaction
    .select()
    .from(bottleChecks)
    .where(eq(bottleChecks.id, operationReference.checkId))
    .limit(1)
    .for("update");
  if (!check) {
    throw new BottleOperationActionError(
      `Bottle check ${checkId} was not found.`,
    );
  }

  const [operation] = await transaction
    .select()
    .from(bottleOperations)
    .where(
      and(
        eq(bottleOperations.id, operationId),
        eq(bottleOperations.checkId, check.id),
      ),
    )
    .limit(1)
    .for("update");
  if (!operation) {
    throw new BottleOperationActionError(
      `Bottle operation ${operationId} was not found in check ${checkId}.`,
    );
  }
  if (check.closedAt !== null) {
    throw new BottleOperationActionError(
      `Bottle check ${check.id} is closed.`,
      operation.status,
    );
  }

  return { check, operation };
}

function sourceFieldsForCheck(check: BottleCheck): string[] {
  if (check.intent === "audit_bottle") {
    return check.inputSnapshot.note === undefined ? [] : ["audit.note"];
  }

  const sourceFields = new Set<string>();
  const reference = check.inputSnapshot.reference;
  if (
    reference !== null &&
    typeof reference === "object" &&
    !Array.isArray(reference)
  ) {
    for (const [field, value] of Object.entries(reference)) {
      if (value !== null && value !== undefined) {
        sourceFields.add(`reference.${field}`);
      }
    }
  }

  const artifacts = BottleClassificationArtifactsSchema.safeParse(
    check.artifacts,
  );
  if (artifacts.success) {
    for (const [field, value] of Object.entries(
      artifacts.data.extractedIdentity ?? {},
    )) {
      if (value !== null && value !== undefined) sourceFields.add(field);
    }
    for (const field of Object.keys(
      artifacts.data.imageEvidence?.fieldCandidates ?? {},
    )) {
      sourceFields.add(field);
    }
  }

  return [...sourceFields];
}

async function reviewPreparationContextForCheck(
  check: BottleCheck,
  database: AnyDatabase,
): Promise<BottleOperationPreparationContext> {
  let protectedBottleIds: number[] = [];
  if (check.storePriceMatchProposalId !== null) {
    const [proposal] = await database
      .select({
        suggestedBottleId: storePriceMatchProposals.suggestedBottleId,
      })
      .from(storePriceMatchProposals)
      .where(eq(storePriceMatchProposals.id, check.storePriceMatchProposalId))
      .limit(1);
    if (proposal?.suggestedBottleId !== null && proposal?.suggestedBottleId) {
      protectedBottleIds = [proposal.suggestedBottleId];
    }
  }

  return {
    artifacts: check.artifacts ?? {},
    capabilities: OPERATION_CAPABILITIES,
    sourceFields: sourceFieldsForCheck(check),
    protectedBottleIds,
    database,
  };
}

async function executionPreparationContextForCheck(
  check: BottleCheck,
  transaction: AnyTransaction,
): Promise<BottleOperationExecutionPreparationContext> {
  return {
    ...(await reviewPreparationContextForCheck(check, transaction)),
    database: transaction,
  };
}

export async function prepareBottleCheckReviewOperations(
  check: BottleCheck & { operations: BottleOperation[] },
  database: AnyDatabase = db,
): Promise<Array<{ operationId: number; review: ReviewOperation | null }>> {
  const preparationContext = await reviewPreparationContextForCheck(
    check,
    database,
  );
  return await Promise.all(
    check.operations.map(async (operation) => {
      if (operation.status === "applied" || operation.status === "rejected") {
        return { operationId: operation.id, review: null };
      }
      if (operation.status === "blocked") {
        const review = BlockedReviewOperationSchema.parse({
          id: operation.id,
          status: "blocked",
          proposal: operation.proposal,
          preparationError: operation.preparationError,
        });
        return { operationId: operation.id, review };
      }

      const liveReview = await prepareOperation({
        operation,
        ...preparationContext,
      });
      const review =
        liveReview.status === "blocked"
          ? liveReview
          : PreparedReviewOperationSchema.parse({
              ...liveReview,
              status: operation.status,
            });
      return { operationId: operation.id, review };
    }),
  );
}

async function markStale(
  transaction: AnyTransaction,
  operationId: number,
): Promise<BottleOperationActionResult> {
  await transaction
    .update(bottleOperations)
    .set({
      status: "stale",
      error:
        "Relevant catalog state changed after this operation was prepared.",
      updatedAt: sql`NOW()`,
    })
    .where(eq(bottleOperations.id, operationId));
  return actionResult(operationId, "stale");
}

async function prepareAndExecute({
  check,
  moderator,
  operation,
  transaction,
}: LockedOperationContext & {
  moderator: User;
  transaction: AnyTransaction;
}): Promise<PreparedExecution | BottleOperationActionResult> {
  let prepared: PreparedOperationExecution;
  try {
    prepared = await prepareOperationForExecution({
      operation,
      ...(await executionPreparationContextForCheck(check, transaction)),
    });
  } catch (error) {
    if (isOperationPreparationFailure(error)) {
      return await markStale(transaction, operation.id);
    }
    throw error;
  }

  if (!isDeepStrictEqual(prepared.review.stateToken, operation.stateToken)) {
    return await markStale(transaction, operation.id);
  }

  const reviewedAt = new Date();
  await transaction
    .update(bottleOperations)
    .set({
      status: "applying",
      reviewedById: moderator.id,
      reviewedAt,
      rejectionReason: null,
      reviewerNote: null,
      result: null,
      error: null,
      executionStartedAt: reviewedAt,
      executionCompletedAt: null,
      updatedAt: reviewedAt,
    })
    .where(eq(bottleOperations.id, operation.id));

  const execution = await executePreparedOperationInTransaction({
    transaction,
    operationId: operation.id,
    prepared,
    approvingModerator: moderator,
  });
  const status = execution.result.status;
  await transaction
    .update(bottleOperations)
    .set({
      status,
      result: BottleOperationExecutionResultSchema.parse(execution.result),
      executionCompletedAt: status === "applied" ? sql`NOW()` : null,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(bottleOperations.id, operation.id),
        eq(bottleOperations.status, "applying"),
      ),
    );

  return {
    operationId: operation.id,
    status,
    afterCommit: execution.afterCommit,
  };
}

async function recordExecutionFailure({
  checkId,
  error,
  moderator,
  operationId,
  database,
}: {
  checkId: number;
  error: unknown;
  moderator: User;
  operationId: number;
  database: AnyConnection;
}) {
  logError(error, {
    extra: {
      checkId,
      operationId,
      phase: "execute_bottle_operation",
    },
  });
  return await database.transaction(async (transaction) => {
    const { operation } = await loadLockedOperationContext({
      checkId,
      operationId,
      transaction,
    });
    if (operation.status !== "pending_review") {
      return actionResult(operation.id, operation.status);
    }

    const now = new Date();
    await transaction
      .update(bottleOperations)
      .set({
        status: "failed",
        reviewedById: moderator.id,
        reviewedAt: now,
        error: "Canonical Bottle operation execution failed.",
        executionStartedAt: now,
        executionCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(bottleOperations.id, operation.id));
    return BottleOperationActionResultSchema.parse({
      operationId: operation.id,
      status: "failed",
      error: "Canonical Bottle operation execution failed.",
    });
  });
}

async function runAfterCommit({
  database,
  execution,
}: {
  database: AnyConnection;
  execution: PreparedExecution;
}): Promise<BottleOperationActionResult> {
  try {
    await execution.afterCommit();
    return actionResult(execution.operationId, execution.status);
  } catch (error) {
    logError(error, {
      extra: {
        operationId: execution.operationId,
        phase: "finalize_or_dispatch_bottle_operation",
      },
    });
    if (execution.status === "applied") {
      return actionResult(execution.operationId, "applied");
    }

    const [failed] = await database
      .update(bottleOperations)
      .set({
        status: "failed",
        error: "Bottle operation dispatch failed.",
        executionCompletedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(bottleOperations.id, execution.operationId),
          eq(bottleOperations.status, "applying"),
        ),
      )
      .returning({ id: bottleOperations.id });
    return BottleOperationActionResultSchema.parse({
      operationId: execution.operationId,
      status: failed ? "failed" : execution.status,
      error: failed ? "Bottle operation dispatch failed." : null,
    });
  }
}

async function approveOne({
  checkId,
  database,
  moderator,
  operationId,
}: {
  checkId: number;
  database: AnyConnection;
  moderator: User;
  operationId: number;
}): Promise<BottleOperationActionResult> {
  let preparedExecution: PreparedExecution | BottleOperationActionResult;
  try {
    preparedExecution = await database.transaction(async (transaction) => {
      const context = await loadLockedOperationContext({
        checkId,
        operationId,
        transaction,
      });
      if (context.operation.status !== "pending_review") {
        throw new BottleOperationActionError(
          `Bottle operation ${operationId} cannot be approved from ${context.operation.status}.`,
          context.operation.status,
        );
      }
      return await prepareAndExecute({
        ...context,
        moderator,
        transaction,
      });
    });
  } catch (error) {
    if (error instanceof BottleOperationActionError) {
      return actionError(operationId, error);
    }
    try {
      return await recordExecutionFailure({
        checkId,
        error,
        moderator,
        operationId,
        database,
      });
    } catch {
      return actionError(operationId, error);
    }
  }

  if ("error" in preparedExecution) return preparedExecution;
  return await runAfterCommit({ database, execution: preparedExecution });
}

export async function approveBottleOperations(
  rawInput: unknown,
  user: User | null,
  database: AnyConnection = db,
): Promise<BottleOperationActionResult[]> {
  assertModerator(user);
  if (!config.BOTTLE_CHECK_EXECUTION) {
    throw new BottleOperationExecutionDisabledError();
  }
  const input = ApproveBottleOperationsInputSchema.parse(rawInput);
  const results: BottleOperationActionResult[] = [];
  for (const operationId of input.operationIds) {
    results.push(
      await approveOne({
        checkId: input.checkId,
        database,
        moderator: user,
        operationId,
      }),
    );
  }
  return results;
}

async function rejectOne({
  checkId,
  database,
  moderator,
  note,
  operationId,
  reason,
}: {
  checkId: number;
  database: AnyConnection;
  moderator: User;
  note?: string;
  operationId: number;
  reason: z.infer<typeof BottleOperationRejectionReasonSchema>;
}): Promise<BottleOperationActionResult> {
  try {
    return await database.transaction(async (transaction) => {
      const { operation } = await loadLockedOperationContext({
        checkId,
        operationId,
        transaction,
      });
      if (!REJECTABLE_STATUSES.has(operation.status)) {
        throw new BottleOperationActionError(
          `Bottle operation ${operationId} cannot be rejected from ${operation.status}.`,
          operation.status,
        );
      }

      await transaction
        .update(bottleOperations)
        .set({
          status: "rejected",
          reviewedById: moderator.id,
          reviewedAt: sql`NOW()`,
          rejectionReason: reason,
          reviewerNote: note ?? null,
          error: null,
          updatedAt: sql`NOW()`,
        })
        .where(eq(bottleOperations.id, operation.id));
      return actionResult(operation.id, "rejected");
    });
  } catch (error) {
    if (!(error instanceof BottleOperationActionError)) {
      logError(error, {
        extra: { checkId, operationId, phase: "reject_bottle_operation" },
      });
    }
    return actionError(operationId, error);
  }
}

export async function rejectBottleOperations(
  rawInput: unknown,
  user: User | null,
  database: AnyConnection = db,
): Promise<BottleOperationActionResult[]> {
  assertModerator(user);
  const input = RejectBottleOperationsInputSchema.parse(rawInput);
  const results: BottleOperationActionResult[] = [];
  for (const operationId of input.operationIds) {
    results.push(
      await rejectOne({
        checkId: input.checkId,
        database,
        moderator: user,
        note: input.note,
        operationId,
        reason: input.reason,
      }),
    );
  }
  return results;
}

async function reconcilePriorExecution({
  moderator,
  operation,
  transaction,
}: {
  moderator: User;
  operation: BottleOperation;
  transaction: AnyTransaction;
}): Promise<Record<string, unknown> | null> {
  const parsedResult = BottleOperationExecutionResultSchema.safeParse(
    operation.result,
  );
  if (parsedResult.success && parsedResult.data.status === "applied") {
    return parsedResult.data;
  }

  const proposal = ProposedOperationSchema.safeParse(operation.proposal);
  if (!proposal.success) return null;

  if (proposal.data.type === "merge_bottles") {
    const [tombstone, source, destination] = await Promise.all([
      transaction.query.bottleTombstones.findFirst({
        where: and(
          eq(bottleTombstones.bottleId, proposal.data.input.sourceBottleId),
          eq(
            bottleTombstones.newBottleId,
            proposal.data.input.destinationBottleId,
          ),
        ),
      }),
      transaction.query.bottles.findFirst({
        where: eq(bottles.id, proposal.data.input.sourceBottleId),
        columns: { id: true },
      }),
      transaction.query.bottles.findFirst({
        where: eq(bottles.id, proposal.data.input.destinationBottleId),
        columns: { id: true },
      }),
    ]);
    if (tombstone?.newBottleId && !source && destination) {
      return {
        type: "merge_bottles",
        status: "applied",
        sourceBottleId: proposal.data.input.sourceBottleId,
        destinationBottleId: tombstone.newBottleId,
        changed: false,
      };
    }
  }

  if (proposal.data.type === "merge_entities") {
    const [tombstone, source, destination] = await Promise.all([
      transaction.query.entityTombstones.findFirst({
        where: and(
          eq(entityTombstones.entityId, proposal.data.input.sourceEntityId),
          eq(
            entityTombstones.newEntityId,
            proposal.data.input.destinationEntityId,
          ),
        ),
      }),
      transaction.query.entities.findFirst({
        where: eq(entities.id, proposal.data.input.sourceEntityId),
        columns: { id: true },
      }),
      transaction.query.entities.findFirst({
        where: eq(entities.id, proposal.data.input.destinationEntityId),
        columns: { id: true, type: true },
      }),
    ]);
    if (tombstone?.newEntityId && !source && destination) {
      return EntityMergeOperationExecutionResultSchema.parse({
        type: "merge_entities",
        sourceEntityId: proposal.data.input.sourceEntityId,
        destinationEntityId: tombstone.newEntityId,
        destinationRoles: destination.type,
        approvingModeratorId: moderator.id,
        reconciled: true,
        execution: { kind: "worker", name: "MergeEntity" },
      });
    }
  }

  return null;
}

async function retryOne({
  checkId,
  database,
  moderator,
  operationId,
}: {
  checkId: number;
  database: AnyConnection;
  moderator: User;
  operationId: number;
}): Promise<BottleOperationActionResult> {
  let preparedExecution: PreparedExecution | BottleOperationActionResult;
  try {
    preparedExecution = await database.transaction(async (transaction) => {
      const context = await loadLockedOperationContext({
        checkId,
        operationId,
        transaction,
      });
      if (context.operation.status !== "failed") {
        throw new BottleOperationActionError(
          `Bottle operation ${operationId} cannot be retried from ${context.operation.status}.`,
          context.operation.status,
        );
      }
      if (context.operation.reviewedById === null) {
        throw new BottleOperationActionError(
          `Bottle operation ${operationId} has no approving moderator.`,
          context.operation.status,
        );
      }
      if (
        !ProposedOperationSchema.safeParse(context.operation.proposal)
          .success ||
        context.operation.stateToken === null
      ) {
        const error =
          "Prior Bottle operation execution could not be reconciled.";
        await transaction
          .update(bottleOperations)
          .set({ error, updatedAt: sql`NOW()` })
          .where(eq(bottleOperations.id, operationId));
        return BottleOperationActionResultSchema.parse({
          operationId,
          status: "failed",
          error,
        });
      }

      const [approvingModerator] = await transaction
        .select()
        .from(users)
        .where(eq(users.id, context.operation.reviewedById))
        .limit(1);
      if (!approvingModerator) {
        throw new BottleOperationActionError(
          `Bottle operation ${operationId} has no approving moderator.`,
          context.operation.status,
        );
      }

      const reconciled = await reconcilePriorExecution({
        moderator: approvingModerator,
        operation: context.operation,
        transaction,
      });
      if (reconciled) {
        await transaction
          .update(bottleOperations)
          .set({
            status: "applied",
            result: reconciled,
            error: null,
            executionCompletedAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          })
          .where(eq(bottleOperations.id, operationId));
        return actionResult(operationId, "applied");
      }

      return await prepareAndExecute({
        ...context,
        moderator: approvingModerator,
        transaction,
      });
    });
  } catch (error) {
    if (!(error instanceof BottleOperationActionError)) {
      logError(error, {
        extra: { checkId, operationId, phase: "retry_bottle_operation" },
      });
      return BottleOperationActionResultSchema.parse({
        operationId,
        status: "failed",
        error: "Bottle operation retry failed.",
      });
    }
    return actionError(operationId, error);
  }

  if ("error" in preparedExecution) return preparedExecution;
  return await runAfterCommit({ database, execution: preparedExecution });
}

export async function retryBottleOperation(
  rawInput: unknown,
  user: User | null,
  database: AnyConnection = db,
): Promise<BottleOperationActionResult> {
  assertModerator(user);
  if (!config.BOTTLE_CHECK_EXECUTION) {
    throw new BottleOperationExecutionDisabledError();
  }
  const input = RetryBottleOperationInputSchema.parse(rawInput);
  return await retryOne({
    checkId: input.checkId,
    database,
    moderator: user,
    operationId: input.operationId,
  });
}
