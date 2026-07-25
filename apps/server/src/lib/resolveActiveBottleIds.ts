import type { AnyTransaction } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
} from "@peated/server/db/schema";
import { asc, inArray } from "drizzle-orm";

export type ActiveBottleRejectionReason =
  | "missing"
  | "unassigned"
  | "bottle_retired"
  | "group_retired";

export class ActiveBottleSelectionError extends Error {
  constructor(public readonly reason: ActiveBottleRejectionReason) {
    super(`Bottle selection is not active: ${reason}.`);
    this.name = "ActiveBottleSelectionError";
  }
}

/**
 * Returns unique, sorted Bottle ids after taking shared row locks and
 * validating their current activity identity in the caller-owned transaction.
 */
export async function resolveActiveBottleIds(
  tx: AnyTransaction,
  inputIds: number[],
): Promise<number[]> {
  const ids = [...new Set(inputIds)].sort((left, right) => left - right);
  if (!ids.length) return [];

  const selectedBottles = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(inArray(bottles.id, ids))
    .orderBy(asc(bottles.id))
    .for("share");
  if (selectedBottles.length !== ids.length) {
    throw new ActiveBottleSelectionError("missing");
  }
  const groupIds = new Set<number>();
  for (const { groupId } of selectedBottles) {
    if (groupId === null) {
      throw new ActiveBottleSelectionError("unassigned");
    }
    groupIds.add(groupId);
  }

  const retiredBottles = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, ids))
    .limit(1);
  if (retiredBottles.length) {
    throw new ActiveBottleSelectionError("bottle_retired");
  }

  const retiredGroups = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(inArray(bottleGroupTombstones.groupId, [...groupIds]))
    .limit(1);
  if (retiredGroups.length) {
    throw new ActiveBottleSelectionError("group_retired");
  }

  return selectedBottles.map(({ id }) => id);
}
