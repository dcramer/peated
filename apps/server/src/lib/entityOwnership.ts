import type { AnyTransaction } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";

export class EntityOwnerNotFoundError extends Error {
  constructor(readonly ownerId: number) {
    super(`Owner Entity ${ownerId} was not found.`);
    this.name = "EntityOwnerNotFoundError";
  }
}

export class EntityOwnershipConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityOwnershipConflictError";
  }
}

/** Locks and validates the proposed owner chain before an Entity write. */
export async function assertValidEntityOwner(
  transaction: AnyTransaction,
  {
    entityId,
    ownerId,
  }: {
    entityId: number;
    ownerId: number | null;
  },
) {
  if (ownerId === null) return;

  const visited = new Set([entityId]);
  let currentOwnerId: number | null = ownerId;
  while (currentOwnerId !== null) {
    if (visited.has(currentOwnerId)) {
      throw new EntityOwnershipConflictError(
        currentOwnerId === entityId && ownerId === entityId
          ? "An Entity cannot own itself."
          : "The owner would create an ownership loop.",
      );
    }
    visited.add(currentOwnerId);

    const [owner] = await transaction
      .select({ id: entities.id, ownerId: entities.ownerId })
      .from(entities)
      .where(eq(entities.id, currentOwnerId))
      .for("update");
    if (!owner) {
      throw new EntityOwnerNotFoundError(currentOwnerId);
    }
    currentOwnerId = owner.ownerId;
  }
}
