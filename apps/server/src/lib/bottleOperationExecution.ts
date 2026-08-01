import type { AnyTransaction } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import type { PreparedOperationExecution } from "@peated/server/lib/bottleOperationReview";
import {
  finalizeConcreteBottleMerge,
  mergeConcreteBottlesInTransaction,
} from "@peated/server/lib/mergeConcreteBottles";
import {
  finalizeConcreteBottleUpdate,
  updateConcreteBottleInTransaction,
} from "@peated/server/lib/updateConcreteBottle";
import {
  finalizeEntityUpdate,
  updateEntityInTransaction,
} from "@peated/server/lib/updateEntity";
import {
  BottleOperationExecutionResultSchema,
  type BottleOperationExecutionResult,
} from "@peated/server/schemas/bottleOperationResults";
import { dispatchEntityMergeOperation } from "@peated/server/worker/entityMerge";

export {
  BottleOperationExecutionResultSchema,
  PersistedBottleOperationExecutionResultSchema,
  type BottleOperationExecutionResult,
} from "@peated/server/schemas/bottleOperationResults";

export type BottleOperationExecution = {
  result: BottleOperationExecutionResult;
  afterCommit: () => Promise<void>;
};

export class BottleOperationExecutionAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to execute a Bottle operation.");
    this.name = "BottleOperationExecutionAuthorizationError";
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled prepared Bottle operation: ${String(value)}`);
}

/**
 * Mutates through canonical transactional cores after the caller compares the
 * prepared state token. `afterCommit` must run only after the outer transaction
 * commits; it owns finalization and asynchronous dispatch.
 */
export async function executePreparedOperationInTransaction({
  approvingModerator,
  operationId,
  prepared,
  transaction,
}: {
  approvingModerator: User;
  operationId: number;
  prepared: PreparedOperationExecution;
  transaction: AnyTransaction;
}): Promise<BottleOperationExecution> {
  if (!approvingModerator.admin && !approvingModerator.mod) {
    throw new BottleOperationExecutionAuthorizationError();
  }
  const actorId = (
    await getUserActorForDatabase(transaction, approvingModerator)
  ).id;

  switch (prepared.type) {
    case "update_bottle": {
      const manifest = await updateConcreteBottleInTransaction(transaction, {
        ...prepared.canonicalInput,
        user: approvingModerator,
        actorId,
        creationSource: "manual_entry",
      });
      return {
        result: BottleOperationExecutionResultSchema.parse({
          type: prepared.type,
          status: "applied",
          bottleId: manifest.bottle.id,
          groupId: manifest.group.id,
          changed: manifest.changed,
        }),
        afterCommit: async () => await finalizeConcreteBottleUpdate(manifest),
      };
    }
    case "merge_bottles": {
      const manifest = await mergeConcreteBottlesInTransaction(transaction, {
        ...prepared.canonicalInput,
        actorId,
      });
      return {
        result: BottleOperationExecutionResultSchema.parse({
          type: prepared.type,
          status: "applied",
          sourceBottleId: manifest.sourceBottleId,
          destinationBottleId: manifest.destinationBottleId,
          changed: manifest.changed,
        }),
        afterCommit: async () => await finalizeConcreteBottleMerge(manifest),
      };
    }
    case "update_entity": {
      const manifest = await updateEntityInTransaction(transaction, {
        ...prepared.canonicalInput,
        user: approvingModerator,
        actorId,
      });
      return {
        result: BottleOperationExecutionResultSchema.parse({
          type: prepared.type,
          status: "applied",
          entityId: manifest.entity.id,
          changed: manifest.changed,
        }),
        afterCommit: async () => await finalizeEntityUpdate(manifest),
      };
    }
    case "merge_entities":
      return {
        result: BottleOperationExecutionResultSchema.parse({
          type: prepared.type,
          status: "applying",
          operationId,
          ...prepared.canonicalInput,
          approvingModeratorId: approvingModerator.id,
        }),
        afterCommit: async () => {
          await dispatchEntityMergeOperation({
            operationId,
            approvingModeratorId: approvingModerator.id,
          });
        },
      };
    default:
      return assertNever(prepared);
  }
}
