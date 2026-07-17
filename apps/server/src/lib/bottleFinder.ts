import { and, eq, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleAliases, catalogTargets } from "../db/schema";
import type { CatalogTargetOperationContext } from "./catalogTargets";
import { logInfo } from "./log";

/**
 * Resolves exact aliases through their authoritative target, never chooses a
 * representative for generic targets, and measures targetless fallback reads.
 */
export async function findBottleTarget(
  name: string,
  context: CatalogTargetOperationContext,
  database: AnyDatabase = db,
): Promise<{
  bottleId: number;
  releaseId: number | null;
  targetId: number | null;
} | null> {
  const [result] = await database
    .select({
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      targetBottleId: catalogTargets.bottleId,
    })
    .from(bottleAliases)
    .leftJoin(catalogTargets, eq(catalogTargets.id, bottleAliases.targetId))
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`),
        sql`${bottleAliases.ignored} IS DISTINCT FROM true`,
      ),
    )
    .limit(1);

  if (!result) {
    return null;
  }

  if (result.targetId !== null) {
    if (result.targetBottleId === null) return null;

    return {
      bottleId: result.targetBottleId,
      releaseId: null,
      targetId: result.targetId,
    };
  }

  if (!result.bottleId) return null;

  if (!context.caller.trim() || !context.operation.trim()) {
    throw new TypeError(
      "Bottle alias compatibility context requires caller and operation.",
    );
  }

  logInfo("Legacy targetless Bottle alias resolution", {
    extra: {
      event: "bottle_alias.compatibility",
      access: "read",
      caller: context.caller,
      operation: context.operation,
      bottleId: result.bottleId,
      releaseId: result.releaseId,
      name,
    },
  });

  return {
    bottleId: result.bottleId,
    releaseId: result.releaseId ?? null,
    targetId: null,
  };
}

export async function findBottleId(
  name: string,
  context: CatalogTargetOperationContext,
  database: AnyDatabase = db,
): Promise<number | null> {
  const target = await findBottleTarget(name, context, database);
  if (target?.bottleId) return target.bottleId;
  return null;
}
