import {
  ProposedOperationSchema,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import type { AnyDatabase } from "@peated/server/db";
import { bottles, entities } from "@peated/server/db/schema";
import { lockBottleMergeDependencies } from "@peated/server/lib/mergeBottles";
import {
  BottleUpdateGraphError,
  lockBottleUpdateDependencies,
} from "@peated/server/lib/updateBottle";
import { eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import {
  BlockedProposalSchema,
  BlockedReviewOperationSchema,
  PreparedProposalSchema,
  PreparedReviewOperationSchema,
  type PreparationError,
  type PreparedProposalResultSchema,
  type ReviewOperation,
} from "../bottleOperationReviewSchemas";
import { prepareBottleMerge, prepareBottleUpdate } from "./bottle";
import { prepareEntityMerge, prepareEntityUpdate } from "./entity";
import {
  assertNever,
  fail,
  OperationPreparationFailure,
  parseContext,
  sameValue,
  sortedUnique,
  validateEvidence,
  type BottleOperationExecutionPreparationContext,
  type BottleOperationPreparationContext,
  type BottleOperationRow,
  type ParsedPreparationContext,
  type PreparedOperationExecution,
} from "./shared";

function overlappingPatchFields(
  left: Extract<ProposedOperation, { type: "update_bottle" | "update_entity" }>,
  right: Extract<
    ProposedOperation,
    { type: "update_bottle" | "update_entity" }
  >,
) {
  const fields = (operation: typeof left) => {
    if (operation.type === "update_entity") {
      return Object.keys(operation.input.patch);
    }
    return Object.keys(operation.input.patch);
  };
  const rightFields = new Set(fields(right));
  return fields(left).some((field) => rightFields.has(field));
}

function existingEntityChoices(
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>,
) {
  const patch = proposal.input.patch;
  return [patch.brand, patch.bottler, ...(patch.distillers ?? [])].flatMap(
    (choice) => (choice?.kind === "existing" ? [choice.entityId] : []),
  );
}

function overlappingBottleSharedFields(
  left: Extract<ProposedOperation, { type: "update_bottle" }>,
  right: Extract<ProposedOperation, { type: "update_bottle" }>,
) {
  const fields = (
    operation: Extract<ProposedOperation, { type: "update_bottle" }>,
  ) => {
    const result = new Set(
      Object.keys(operation.input.patch).filter((field) =>
        [
          "name",
          "category",
          "seriesId",
          "brand",
          "distillers",
          "bottler",
        ].includes(field),
      ),
    );
    if (result.has("name")) result.add("statedAge");
    return result;
  };
  const rightFields = fields(right);
  return [...fields(left)].some((field) => rightFields.has(field));
}

function operationsConflict(
  left: ProposedOperation,
  right: ProposedOperation,
  bottleGroupsByBottleId: ReadonlyMap<number, number>,
): boolean {
  if (sameValue(left, right)) return true;

  if (left.type === "update_bottle" && right.type === "update_bottle") {
    if (
      left.input.bottleId === right.input.bottleId &&
      overlappingPatchFields(left, right)
    ) {
      return true;
    }
    const leftGroupId = bottleGroupsByBottleId.get(left.input.bottleId);
    return (
      leftGroupId !== undefined &&
      leftGroupId === bottleGroupsByBottleId.get(right.input.bottleId) &&
      overlappingBottleSharedFields(left, right)
    );
  }
  if (left.type === "update_entity" && right.type === "update_entity") {
    return (
      left.input.entityId === right.input.entityId &&
      overlappingPatchFields(left, right)
    );
  }
  if (left.type === "merge_bottles" && right.type === "merge_bottles") {
    return [left.input.sourceBottleId, left.input.destinationBottleId].some(
      (id) =>
        [right.input.sourceBottleId, right.input.destinationBottleId].includes(
          id,
        ),
    );
  }
  if (left.type === "merge_entities" && right.type === "merge_entities") {
    return [left.input.sourceEntityId, left.input.destinationEntityId].some(
      (id) =>
        [right.input.sourceEntityId, right.input.destinationEntityId].includes(
          id,
        ),
    );
  }
  if (left.type === "update_bottle" && right.type === "merge_bottles") {
    return left.input.bottleId === right.input.sourceBottleId;
  }
  if (left.type === "merge_bottles" && right.type === "update_bottle") {
    return operationsConflict(right, left, bottleGroupsByBottleId);
  }
  if (left.type === "update_entity" && right.type === "merge_entities") {
    return (
      left.input.entityId === right.input.sourceEntityId ||
      (left.input.entityId === right.input.destinationEntityId &&
        (left.input.patch.name !== undefined ||
          left.input.patch.shortName !== undefined ||
          left.input.patch.roles !== undefined))
    );
  }
  if (left.type === "merge_entities" && right.type === "update_entity") {
    return operationsConflict(right, left, bottleGroupsByBottleId);
  }
  if (left.type === "update_bottle" && right.type === "merge_entities") {
    return existingEntityChoices(left).includes(right.input.sourceEntityId);
  }
  if (left.type === "merge_entities" && right.type === "update_bottle") {
    return operationsConflict(right, left, bottleGroupsByBottleId);
  }
  return false;
}

async function conflictIndexes(
  proposals: ProposedOperation[],
  database: AnyDatabase,
) {
  const updateBottleIds = sortedUnique(
    proposals.flatMap((proposal) =>
      proposal.type === "update_bottle" ? [proposal.input.bottleId] : [],
    ),
  );
  const groupRows = updateBottleIds.length
    ? await database
        .select({ bottleId: bottles.id, groupId: bottles.groupId })
        .from(bottles)
        .where(inArray(bottles.id, updateBottleIds))
    : [];
  const bottleGroupsByBottleId = new Map(
    groupRows.flatMap(({ bottleId, groupId }) =>
      groupId === null ? [] : [[bottleId, groupId] as const],
    ),
  );
  const conflicts = new Set<number>();
  for (let left = 0; left < proposals.length; left += 1) {
    for (let right = left + 1; right < proposals.length; right += 1) {
      if (
        operationsConflict(
          proposals[left]!,
          proposals[right]!,
          bottleGroupsByBottleId,
        )
      ) {
        conflicts.add(left);
        conflicts.add(right);
      }
    }
  }
  return conflicts;
}

async function prepareParsedOperation({
  proposal,
  context,
}: {
  proposal: ProposedOperation;
  context: ParsedPreparationContext;
}): Promise<PreparedOperationExecution> {
  validateEvidence(proposal, context);

  switch (proposal.type) {
    case "update_bottle":
      return prepareBottleUpdate(proposal, context);
    case "merge_bottles":
      return prepareBottleMerge(proposal, context);
    case "update_entity":
      return prepareEntityUpdate(proposal, context);
    case "merge_entities":
      return prepareEntityMerge(proposal, context);
    default:
      return assertNever(proposal);
  }
}

type PreparationOutcome =
  | {
      status: "prepared";
      data: PreparedOperationExecution;
    }
  | {
      status: "blocked";
      proposal: ProposedOperation;
      preparationError: PreparationError;
    };

async function prepareParsedProposals(
  proposals: ProposedOperation[],
  context: ParsedPreparationContext,
): Promise<PreparationOutcome[]> {
  const conflicts = await conflictIndexes(proposals, context.database);
  return Promise.all(
    proposals.map(async (proposal, index) => {
      try {
        if (conflicts.has(index)) {
          fail(
            "direct_conflict",
            "Operation directly conflicts with another proposal in this check.",
          );
        }
        return {
          status: "prepared" as const,
          data: await prepareParsedOperation({ proposal, context }),
        };
      } catch (error) {
        if (!(error instanceof OperationPreparationFailure)) throw error;
        return {
          status: "blocked" as const,
          proposal,
          preparationError: error.toJSON(),
        };
      }
    }),
  );
}

function proposedBottleUpdateEntityIds(
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>,
): number[] {
  const patch = proposal.input.patch;
  const choices = [patch.brand, patch.bottler, ...(patch.distillers ?? [])];
  return choices.flatMap((choice) =>
    choice?.kind === "existing" ? [choice.entityId] : [],
  );
}

/**
 * Rebuilds canonical service input from a persisted proposal and live state.
 * The returned input is server-only and must never be serialized for review.
 */
export async function prepareOperationForExecution({
  operation,
  ...rawContext
}: BottleOperationExecutionPreparationContext & {
  operation: BottleOperationRow;
}): Promise<PreparedOperationExecution> {
  const proposal = ProposedOperationSchema.parse(operation.proposal);
  if (proposal.type === "update_bottle") {
    try {
      await lockBottleUpdateDependencies(
        rawContext.database,
        proposal.input.bottleId,
        proposedBottleUpdateEntityIds(proposal),
      );
    } catch (error) {
      if (error instanceof BottleUpdateGraphError) {
        fail("invalid_current_state", error.message);
      }
      throw error;
    }
  } else if (proposal.type === "merge_bottles") {
    await lockBottleMergeDependencies(rawContext.database, proposal.input);
  } else if (proposal.type === "update_entity") {
    await rawContext.database
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, proposal.input.entityId))
      .limit(1)
      .for("update");
  }
  const context = parseContext(rawContext);
  return await prepareParsedOperation({ proposal, context });
}

export async function prepareOperation({
  operation,
  ...rawContext
}: BottleOperationPreparationContext & {
  operation: BottleOperationRow;
}): Promise<ReviewOperation> {
  const context = parseContext(rawContext);
  const proposal = ProposedOperationSchema.parse(operation.proposal);
  try {
    const data = await prepareParsedOperation({ proposal, context });
    return PreparedReviewOperationSchema.parse({
      id: operation.id,
      status: "pending_review",
      ...data.review,
    });
  } catch (error) {
    if (!(error instanceof OperationPreparationFailure)) throw error;
    return BlockedReviewOperationSchema.parse({
      id: operation.id,
      status: "blocked",
      proposal,
      preparationError: error.toJSON(),
    });
  }
}

export async function prepareOperations({
  operations,
  ...rawContext
}: BottleOperationPreparationContext & {
  operations: BottleOperationRow[];
}): Promise<ReviewOperation[]> {
  const context = parseContext(rawContext);
  const seenIds = new Set<number>();
  const parsed = operations.map(({ id, proposal: rawProposal }) => {
    if (!Number.isSafeInteger(id) || id <= 0 || seenIds.has(id)) {
      throw new RangeError("Operation ids must be unique positive integers.");
    }
    seenIds.add(id);
    return { id, proposal: ProposedOperationSchema.parse(rawProposal) };
  });
  const outcomes = await prepareParsedProposals(
    parsed.map(({ proposal }) => proposal),
    context,
  );
  return outcomes.map((outcome, index) => {
    const id = parsed[index]!.id;
    return outcome.status === "prepared"
      ? PreparedReviewOperationSchema.parse({
          id,
          status: "pending_review",
          ...outcome.data.review,
        })
      : BlockedReviewOperationSchema.parse({
          id,
          status: "blocked",
          proposal: outcome.proposal,
          preparationError: outcome.preparationError,
        });
  });
}

export async function prepareProposals({
  proposals: rawProposals,
  ...rawContext
}: BottleOperationPreparationContext & {
  proposals: unknown[];
}): Promise<Array<z.infer<typeof PreparedProposalResultSchema>>> {
  const context = parseContext(rawContext);
  const proposals = rawProposals.map((proposal) =>
    ProposedOperationSchema.parse(proposal),
  );
  const outcomes = await prepareParsedProposals(proposals, context);
  return outcomes.map((outcome) =>
    outcome.status === "prepared"
      ? PreparedProposalSchema.parse({
          status: "pending_review",
          proposal: outcome.data.review.proposal,
          stateToken: outcome.data.review.stateToken,
        })
      : BlockedProposalSchema.parse({
          status: "blocked",
          proposal: outcome.proposal,
          preparationError: outcome.preparationError,
        }),
  );
}
