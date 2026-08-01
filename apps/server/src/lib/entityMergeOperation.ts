import {
  EntityContextSchema,
  MergeEntitiesOperationSchema,
} from "@peated/bottle-classifier";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleChecks,
  bottleOperations,
  entities,
  users,
} from "@peated/server/db/schema";
import { getPersistedBottleCheckSourceEvidencePaths } from "@peated/server/lib/bottleCheckEvidence";
import {
  isBottleCheckPrimaryDecisionTerminal,
  lockBottleCheckPrimaryDecisionAttempt,
} from "@peated/server/lib/bottleCheckPrimaryDecision";
import {
  assertSupportedBottleCheckSchemaVersion,
  UnsupportedBottleCheckSchemaVersionError,
} from "@peated/server/lib/bottleCheckSchemaVersion";
import {
  isOperationPreparationFailure,
  prepareOperationForExecution,
} from "@peated/server/lib/bottleOperationReview";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

const PositiveIdSchema = z.number().int().positive();

export const EntityMergeOperationExecutionResultSchema = z
  .object({
    type: z.literal("merge_entities"),
    sourceEntityId: PositiveIdSchema,
    destinationEntityId: PositiveIdSchema,
    destinationRoles: EntityContextSchema.shape.roles,
    approvingModeratorId: PositiveIdSchema,
    reconciled: z.boolean(),
    execution: z
      .object({
        kind: z.literal("worker"),
        name: z.literal("MergeEntity"),
      })
      .strict(),
  })
  .strict();

const EntityMergeOperationDispatchResultSchema = z
  .object({
    type: z.literal("merge_entities"),
    status: z.literal("applying"),
    operationId: PositiveIdSchema,
    sourceEntityId: PositiveIdSchema,
    destinationEntityId: PositiveIdSchema,
    approvingModeratorId: PositiveIdSchema,
  })
  .strict();

export type EntityMergeOperationExecutionResult = z.infer<
  typeof EntityMergeOperationExecutionResultSchema
>;

export class EntityMergeOperationExecutionError extends Error {
  constructor(
    message: string,
    readonly operationId: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EntityMergeOperationExecutionError";
  }
}

export type LoadedEntityMergeOperation = {
  operationId: number;
  status: "applying" | "applied" | "failed";
  sourceEntityId: number;
  destinationEntityId: number;
  approvingModerator: User;
  result: EntityMergeOperationExecutionResult | null;
};

export async function loadEntityMergeOperation({
  operationId,
  approvingModeratorId,
  database = db,
  lock = false,
}: {
  operationId: number;
  approvingModeratorId: number;
  database?: AnyDatabase;
  lock?: boolean;
}): Promise<LoadedEntityMergeOperation> {
  const [operationReference] = await database
    .select({ checkId: bottleOperations.checkId })
    .from(bottleOperations)
    .where(eq(bottleOperations.id, operationId))
    .limit(1);
  if (!operationReference) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} was not found.`,
      operationId,
    );
  }

  const checkQuery = () =>
    database
      .select({
        closedAt: bottleChecks.closedAt,
        intent: bottleChecks.intent,
        sourceKind: bottleChecks.sourceKind,
        sourceId: bottleChecks.sourceId,
        storePriceMatchAttemptId: bottleChecks.storePriceMatchAttemptId,
        storePriceMatchProposalId: bottleChecks.storePriceMatchProposalId,
      })
      .from(bottleChecks)
      .where(eq(bottleChecks.id, operationReference.checkId))
      .limit(1);
  const [checkReference] = await checkQuery();
  if (lock && checkReference) {
    await lockBottleCheckPrimaryDecisionAttempt(checkReference, database);
  }
  const [check] = lock ? await checkQuery().for("update") : [checkReference];
  if (
    check &&
    checkReference &&
    (check.storePriceMatchAttemptId !==
      checkReference.storePriceMatchAttemptId ||
      check.storePriceMatchProposalId !==
        checkReference.storePriceMatchProposalId)
  ) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} primary decision linkage changed.`,
      operationId,
    );
  }
  const operationQuery = database
    .select()
    .from(bottleOperations)
    .where(eq(bottleOperations.id, operationId))
    .limit(1);
  const [operation] = lock
    ? await operationQuery.for("update")
    : await operationQuery;
  if (operation && operation.checkId !== operationReference.checkId) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} changed checks before execution.`,
      operationId,
    );
  }
  if (!operation) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} was not found.`,
      operationId,
    );
  }
  const [approvingModerator] = await database
    .select()
    .from(users)
    .where(eq(users.id, approvingModeratorId))
    .limit(1);

  if (!check || check.closedAt !== null) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} belongs to a closed check.`,
      operationId,
    );
  }
  if (
    operation.reviewedById !== approvingModeratorId ||
    operation.reviewedAt === null ||
    !approvingModerator
  ) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} has no matching approving moderator.`,
      operationId,
    );
  }
  if (
    operation.status !== "applying" &&
    operation.status !== "applied" &&
    operation.status !== "failed"
  ) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} is not executable from ${operation.status}.`,
      operationId,
    );
  }

  const proposal = MergeEntitiesOperationSchema.safeParse(operation.proposal);
  if (!proposal.success) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} is not a valid Entity merge.`,
      operationId,
      { cause: proposal.error },
    );
  }

  let result: EntityMergeOperationExecutionResult | null = null;
  if (operation.status === "applied") {
    const parsedResult = EntityMergeOperationExecutionResultSchema.safeParse(
      operation.result,
    );
    if (!parsedResult.success) {
      throw new EntityMergeOperationExecutionError(
        `Bottle operation ${operationId} has no valid applied result.`,
        operationId,
        { cause: parsedResult.error },
      );
    }
    result = parsedResult.data;
  } else if (operation.status === "applying" || operation.result !== null) {
    const parsedDispatch = EntityMergeOperationDispatchResultSchema.safeParse(
      operation.result,
    );
    if (!parsedDispatch.success) {
      throw new EntityMergeOperationExecutionError(
        `Bottle operation ${operationId} has an invalid dispatch result.`,
        operationId,
        { cause: parsedDispatch.error },
      );
    }
    if (parsedDispatch.data.operationId !== operationId) {
      throw new EntityMergeOperationExecutionError(
        `Bottle operation ${operationId} has an invalid dispatch result.`,
        operationId,
      );
    }
  }
  const persistedResult = result ?? operation.result;
  if (
    persistedResult !== null &&
    (persistedResult.sourceEntityId !== proposal.data.input.sourceEntityId ||
      persistedResult.destinationEntityId !==
        proposal.data.input.destinationEntityId ||
      persistedResult.approvingModeratorId !== approvingModeratorId)
  ) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} has an invalid execution result.`,
      operationId,
    );
  }

  return {
    operationId,
    status: operation.status,
    sourceEntityId: proposal.data.input.sourceEntityId,
    destinationEntityId: proposal.data.input.destinationEntityId,
    approvingModerator,
    result,
  };
}

export async function revalidateApplyingEntityMergeOperation({
  operationId,
  database,
}: {
  operationId: number;
  database: AnyTransaction;
}): Promise<boolean> {
  const [operation] = await database
    .select()
    .from(bottleOperations)
    .where(eq(bottleOperations.id, operationId))
    .limit(1);
  if (!operation || operation.status !== "applying") {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} is not applying.`,
      operationId,
    );
  }
  const [check] = await database
    .select()
    .from(bottleChecks)
    .where(eq(bottleChecks.id, operation.checkId))
    .limit(1);
  if (!check || check.closedAt !== null) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} belongs to a closed check.`,
      operationId,
    );
  }
  try {
    assertSupportedBottleCheckSchemaVersion(check);
  } catch (error) {
    if (!(error instanceof UnsupportedBottleCheckSchemaVersionError)) {
      throw error;
    }
    await database
      .update(bottleOperations)
      .set({
        status: "failed",
        error: error.message,
        executionCompletedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(bottleOperations.id, operationId),
          eq(bottleOperations.status, "applying"),
        ),
      );
    return false;
  }
  if (!(await isBottleCheckPrimaryDecisionTerminal(check, database))) {
    await database
      .update(bottleOperations)
      .set({
        status: "stale",
        error: "The linked primary store-price decision is no longer complete.",
        executionCompletedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(bottleOperations.id, operationId),
          eq(bottleOperations.status, "applying"),
        ),
      );
    return false;
  }
  const proposal = MergeEntitiesOperationSchema.safeParse(operation.proposal);
  if (!proposal.success) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} is not a valid Entity merge.`,
      operationId,
      { cause: proposal.error },
    );
  }
  await database
    .select({ id: entities.id })
    .from(entities)
    .where(
      inArray(entities.id, [
        proposal.data.input.sourceEntityId,
        proposal.data.input.destinationEntityId,
      ]),
    )
    .orderBy(asc(entities.id))
    .for("update");

  let prepared;
  try {
    prepared = await prepareOperationForExecution({
      operation,
      artifacts: check.artifacts ?? {},
      sourceFields: getPersistedBottleCheckSourceEvidencePaths(check),
      database,
    });
  } catch (error) {
    if (!isOperationPreparationFailure(error)) throw error;
    await database
      .update(bottleOperations)
      .set({
        status: "stale",
        error:
          "Relevant catalog state changed before the Entity merge worker ran.",
        executionCompletedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(bottleOperations.id, operationId),
          eq(bottleOperations.status, "applying"),
        ),
      );
    return false;
  }

  if (isDeepStrictEqual(prepared.review.stateToken, operation.stateToken)) {
    return true;
  }
  await database
    .update(bottleOperations)
    .set({
      status: "stale",
      error:
        "Relevant catalog state changed before the Entity merge worker ran.",
      executionCompletedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(bottleOperations.id, operationId),
        eq(bottleOperations.status, "applying"),
      ),
    );
  return false;
}

export async function markEntityMergeOperationApplied({
  database,
  result,
  operationId,
}: {
  database: AnyDatabase;
  result: EntityMergeOperationExecutionResult;
  operationId: number;
}) {
  const [operation] = await database
    .update(bottleOperations)
    .set({
      status: "applied",
      result: EntityMergeOperationExecutionResultSchema.parse(result),
      error: null,
      executionCompletedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(bottleOperations.id, operationId),
        eq(bottleOperations.status, "applying"),
      ),
    )
    .returning({ id: bottleOperations.id });

  if (!operation) {
    throw new EntityMergeOperationExecutionError(
      `Bottle operation ${operationId} left applying before completion.`,
      operationId,
    );
  }
}

export async function markEntityMergeOperationFailed({
  operationId,
  approvingModeratorId,
  error,
}: {
  operationId: number;
  approvingModeratorId: number;
  error: unknown;
}) {
  const message =
    error instanceof EntityMergeOperationExecutionError
      ? error.message
      : "Entity merge execution failed.";

  await db
    .update(bottleOperations)
    .set({
      status: "failed",
      error: message,
      executionCompletedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(bottleOperations.id, operationId),
        eq(bottleOperations.status, "applying"),
        eq(bottleOperations.reviewedById, approvingModeratorId),
      ),
    );
}
