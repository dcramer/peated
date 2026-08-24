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
  const retiredBottles = await tx
    .select({
      bottleId: bottleTombstones.bottleId,
      replacementBottleId: bottleTombstones.newBottleId,
    })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, ids))
    .orderBy(asc(bottleTombstones.bottleId))
    .for(lock);

  const selectedById = new Map(
    selectedBottles.map((bottle) => [bottle.id, bottle]),
  );
  const retiredById = new Map(
    retiredBottles.map((bottle) => [bottle.bottleId, bottle]),
  );
  for (const id of ids) {
    const retiredBottle = retiredById.get(id);
    if (retiredBottle) {
      throw new ActiveBottleSelectionError(
        "bottle_retired",
        id,
        retiredBottle.replacementBottleId,
      );
    }

    const selectedBottle = selectedById.get(id);
    if (!selectedBottle) {
      throw new ActiveBottleSelectionError("missing", id);
    }
    if (selectedBottle.groupId === null) {
      throw new ActiveBottleSelectionError("unassigned", id);
    }
  }

  return selectedBottles.map(({ id }) => id);
}
