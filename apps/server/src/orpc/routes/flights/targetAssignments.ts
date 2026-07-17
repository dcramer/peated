import type { AnyTransaction } from "@peated/server/db";
import {
  type CatalogTargetAssignmentDescriptor,
  type CatalogTargetOperationContext,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";

export type FlightTargetAssignment = {
  target: CatalogTargetAssignmentDescriptor;
  retainedBottleId: number;
};

/**
 * Resolves each submitted Bottle as a legacy null-release pair, canonicalizes
 * by durable target, and retains the lowest submitted Bottle id for that
 * target. Generic targets never substitute a representative Bottle.
 */
export async function resolveFlightTargetAssignments(
  tx: AnyTransaction,
  bottleIds: number[],
  context: CatalogTargetOperationContext,
): Promise<FlightTargetAssignment[]> {
  const assignmentsByTarget = new Map<number, FlightTargetAssignment>();
  for (const bottleId of new Set(bottleIds)) {
    const target = await resolveCatalogTargetForAssignment(
      {
        kind: "legacy",
        bottleId,
        releaseId: null,
        context,
      },
      tx,
    );
    const current = assignmentsByTarget.get(target.targetId);
    if (!current || bottleId < current.retainedBottleId) {
      assignmentsByTarget.set(target.targetId, {
        target,
        retainedBottleId: bottleId,
      });
    }
  }

  return [...assignmentsByTarget.values()].sort(
    (a, b) => a.target.targetId - b.target.targetId,
  );
}
