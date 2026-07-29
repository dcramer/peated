import type { AnyTransaction } from "@peated/server/db";
import { bottles, bottleTombstones } from "@peated/server/db/schema";
import { asc, inArray } from "drizzle-orm";

export type ActiveBottleRejectionReason =
  | "missing"
  | "unassigned"
  | "bottle_retired";

export class ActiveBottleSelectionError extends Error {
  constructor(
    public readonly reason: ActiveBottleRejectionReason,
    public readonly bottleId: number,
    public readonly replacementBottleId: number | null = null,
  ) {
    super(`Bottle ${bottleId} is not active: ${reason}.`);
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
  { lock = "share" }: { lock?: "share" | "update" } = {},
): Promise<number[]> {
  const ids = [...new Set(inputIds)].sort((left, right) => left - right);
  if (!ids.length) return [];

  const selectedBottles = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(inArray(bottles.id, ids))
    .orderBy(asc(bottles.id))
    .for(lock);
  if (selectedBottles.length !== ids.length) {
    const selectedIds = new Set(selectedBottles.map(({ id }) => id));
    throw new ActiveBottleSelectionError(
      "missing",
      ids.find((id) => !selectedIds.has(id))!,
    );
  }
  for (const { id, groupId } of selectedBottles) {
    if (groupId === null) {
      throw new ActiveBottleSelectionError("unassigned", id);
    }
  }

  const retiredBottles = await tx
    .select({
      bottleId: bottleTombstones.bottleId,
      replacementBottleId: bottleTombstones.newBottleId,
    })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, ids))
    .limit(1);
  const retiredBottle = retiredBottles[0];
  if (retiredBottle) {
    throw new ActiveBottleSelectionError(
      "bottle_retired",
      retiredBottle.bottleId,
      retiredBottle.replacementBottleId,
    );
  }

  return selectedBottles.map(({ id }) => id);
}
