import type { AnyTransaction } from "@peated/server/db";
import {
  type CatalogTargetAssignmentDescriptor,
  type CatalogTargetOperationContext,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";

export type FlightTargetAssignment = {
  target: CatalogTargetAssignmentDescriptor;
  retainedBottleId: number | null;
};

type FlightTargetSelection =
  | { kind: "targets"; ids: number[] }
  | { kind: "bottles"; ids: number[] };

/**
 * Resolves canonical target ids directly or translates staged Bottle ids as
 * legacy null-release pairs, then canonicalizes by durable target. Legacy
 * duplicates retain the lowest submitted Bottle id; target-native generic
 * assignments retain null and never substitute a representative Bottle. Task
 * 9.7 removes the Bottle-id compatibility adapter.
 */
export async function resolveFlightTargetAssignments(
  tx: AnyTransaction,
  selection: FlightTargetSelection,
  context: CatalogTargetOperationContext,
): Promise<FlightTargetAssignment[]> {
  const assignmentsByTarget = new Map<number, FlightTargetAssignment>();
  for (const id of new Set(selection.ids)) {
    const target = await resolveCatalogTargetForAssignment(
      selection.kind === "targets"
        ? { kind: "target", targetId: id }
        : {
            kind: "legacy",
            bottleId: id,
            releaseId: null,
            context,
          },
      tx,
    );
    const current = assignmentsByTarget.get(target.targetId);
    const retainedBottleId =
      selection.kind === "targets" ? target.bottleId : id;
    if (
      !current ||
      (retainedBottleId !== null &&
        (current.retainedBottleId === null ||
          retainedBottleId < current.retainedBottleId))
    ) {
      assignmentsByTarget.set(target.targetId, {
        target,
        retainedBottleId,
      });
    }
  }

  return [...assignmentsByTarget.values()].sort(
    (a, b) => a.target.targetId - b.target.targetId,
  );
}
