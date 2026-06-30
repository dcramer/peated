import { and, eq, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleAliases } from "../db/schema";

export async function findBottleTarget(
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
  const target = await findBottleTarget(name, database);
  if (target?.bottleId) return target.bottleId;
  return null;
}
