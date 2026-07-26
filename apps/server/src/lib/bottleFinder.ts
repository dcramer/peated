import { and, eq, sql } from "drizzle-orm";
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
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
      ),
    )
    .limit(1);
  return alias ?? null;
}

/**
 * Resolves an accepted alias to its directly assigned Bottle. Retained release,
 * promotion, and CatalogTarget evidence never overrides `bottleId`.
 */
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
