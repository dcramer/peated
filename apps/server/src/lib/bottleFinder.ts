import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleAliases } from "../db/schema";
import type { BottleAliasIdentitySnapshot } from "./bottleAliases";

export type BottleAliasAssignmentMatch = {
  alias: BottleAliasIdentitySnapshot;
  bottleId: number;
};

async function findBottleAliasIdentitySnapshot(
  name: string,
  database: AnyDatabase,
): Promise<BottleAliasIdentitySnapshot | null> {
  const [alias] = await database
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      ignored: bottleAliases.ignored,
      assignmentSource: bottleAliases.assignmentSource,
      assignedByActorId: bottleAliases.assignedByActorId,
      createdAt: bottleAliases.createdAt,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
        isNotNull(bottleAliases.bottleId),
      ),
    )
    .limit(1);
  return alias ?? null;
}

/** Resolves a non-ignored alias to its directly assigned Bottle id. */
export async function findBottleAliasAssignment(
  name: string,
  database: AnyDatabase = db,
): Promise<BottleAliasAssignmentMatch | null> {
  const alias = await findBottleAliasIdentitySnapshot(name, database);
  if (!alias || alias.bottleId === null) return null;

  return {
    alias,
    bottleId: alias.bottleId,
  };
}

export async function findBottleId(
  name: string,
  database: AnyDatabase = db,
): Promise<number | null> {
  const match = await findBottleAliasAssignment(name, database);
  return match?.bottleId ?? null;
}
