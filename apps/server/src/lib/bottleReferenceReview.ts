import { db, type AnyConnection } from "@peated/server/db";
import {
  bottleReferences,
  bottles,
  type BottleReference,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

type ReferenceReviewState = Pick<
  BottleReference,
  | "id"
  | "bottleId"
  | "ignored"
  | "assignmentSource"
  | "assignedByActorId"
  | "reviewedByActorId"
  | "reviewedAt"
>;

export class BottleReferenceNotFoundError extends Error {
  constructor() {
    super("Bottle reference not found.");
    this.name = "BottleReferenceNotFoundError";
  }
}

export class BottleReferenceReviewConflictError extends Error {
  constructor(message = "Bottle reference changed. Reload it and try again.") {
    super(message);
    this.name = "BottleReferenceReviewConflictError";
  }
}

export function getBottleReferenceStateToken(reference: ReferenceReviewState) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        reference.id,
        reference.bottleId,
        reference.ignored,
        reference.assignmentSource,
        reference.assignedByActorId,
        reference.reviewedByActorId,
        reference.reviewedAt?.toISOString() ?? null,
      ]),
    )
    .digest("hex");
}

export async function reviewBottleReference(
  {
    referenceId,
    action,
    actorId,
    stateToken,
  }: {
    referenceId: number;
    action: "verify" | "quarantine";
    actorId: number;
    stateToken: string;
  },
  database: AnyConnection = db,
) {
  return await database.transaction(async (tx) => {
    const [reference] = await tx
      .select()
      .from(bottleReferences)
      .where(eq(bottleReferences.id, referenceId))
      .for("update");
    if (!reference) throw new BottleReferenceNotFoundError();
    if (getBottleReferenceStateToken(reference) !== stateToken) {
      throw new BottleReferenceReviewConflictError();
    }
    if (reference.bottleId === null) {
      throw new BottleReferenceReviewConflictError(
        "Only an assigned Bottle reference can be reviewed.",
      );
    }

    const [bottle] = await tx
      .select({ fullName: bottles.fullName })
      .from(bottles)
      .where(eq(bottles.id, reference.bottleId));
    if (!bottle) {
      throw new BottleReferenceReviewConflictError(
        "The assigned Bottle is no longer active.",
      );
    }
    if (
      action === "quarantine" &&
      reference.name.toLowerCase() === bottle.fullName.toLowerCase()
    ) {
      throw new BottleReferenceReviewConflictError(
        "The Bottle's primary name cannot be removed from matching.",
      );
    }

    const reviewedAt = new Date();
    // The row lock and token check own the optimistic-write boundary.
    const [updated] = await tx
      .update(bottleReferences)
      .set({
        ignored: action === "quarantine" ? true : reference.ignored,
        embedding: action === "quarantine" ? null : reference.embedding,
        reviewedByActorId: actorId,
        reviewedAt,
      })
      .where(eq(bottleReferences.id, reference.id))
      .returning();
    if (!updated) throw new BottleReferenceReviewConflictError();
    return updated;
  });
}
