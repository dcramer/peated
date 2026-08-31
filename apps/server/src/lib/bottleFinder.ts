import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleReferences } from "../db/schema";
import type { BottleReferenceIdentitySnapshot } from "./bottleReferences";

export type BottleReferenceAssignmentMatch = {
  reference: BottleReferenceIdentitySnapshot;
  bottleId: number;
};

async function findBottleReferenceIdentitySnapshot(
  name: string,
  database: AnyDatabase,
): Promise<BottleReferenceIdentitySnapshot | null> {
  const [reference] = await database
    .select({
      name: bottleReferences.name,
      bottleId: bottleReferences.bottleId,
      ignored: bottleReferences.ignored,
      assignmentSource: bottleReferences.assignmentSource,
      assignedByActorId: bottleReferences.assignedByActorId,
      createdAt: bottleReferences.createdAt,
    })
    .from(bottleReferences)
    .where(
      and(
        eq(sql`LOWER(${bottleReferences.name})`, sql`LOWER(${name})`),
        sql`${bottleReferences.ignored} IS DISTINCT FROM true`,
        isNotNull(bottleReferences.bottleId),
      ),
    )
    .limit(1);
  return reference ?? null;
}

/** Resolves a non-ignored reference to its directly assigned Bottle id. */
export async function findBottleReferenceAssignment(
  name: string,
  database: AnyDatabase = db,
): Promise<BottleReferenceAssignmentMatch | null> {
  const reference = await findBottleReferenceIdentitySnapshot(name, database);
  if (!reference || reference.bottleId === null) return null;

  return {
    reference,
    bottleId: reference.bottleId,
  };
}

export async function findBottleId(
  name: string,
  database: AnyDatabase = db,
): Promise<number | null> {
  const match = await findBottleReferenceAssignment(name, database);
  return match?.bottleId ?? null;
}
