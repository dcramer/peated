import { and, eq, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleAliases } from "../db/schema";

/**
 * Returns only trusted, non-ignored exact aliases for the no-agent fast path.
 */
export async function findTrustedBottleTarget(
  name: string,
  database: AnyDatabase = db,
): Promise<{ bottleId: number; releaseId: number | null } | null> {
  const [result] = await database
    .select({
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`),
        eq(bottleAliases.assignmentTrusted, true),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
      ),
    )
    .limit(1);

  if (!result?.bottleId) {
    return null;
  }

  return {
    bottleId: result.bottleId,
    releaseId: result.releaseId ?? null,
  };
}

export async function findBottleId(
  name: string,
  database: AnyDatabase = db,
): Promise<number | null> {
  const target = await findTrustedBottleTarget(name, database);
  if (target?.bottleId) return target.bottleId;
  return null;
}
