import { db, type AnyDatabase } from "@peated/server/db";
import { catalogTargets } from "@peated/server/db/schema";
import { and, asc, inArray, isNotNull } from "drizzle-orm";

export type ExactCatalogTargetStatsRepairIdentity = {
  targetId: number;
  bottleId: number;
};

/**
 * Returns a deterministic, Bottle-ID-ordered page of exact CatalogTarget/Bottle
 * identities, optionally filtered by Bottle ID. Generic targets and targetless
 * rows are excluded. Callers feed each returned Bottle ID into strict
 * recomputation, which validates the active graph and stops on integrity errors.
 */
export async function getExactCatalogTargetStatsRepairPage(
  {
    bottleIds,
    limit,
    offset = 0,
  }: {
    bottleIds?: number[];
    limit: number;
    offset?: number;
  },
  database: AnyDatabase = db,
): Promise<ExactCatalogTargetStatsRepairIdentity[]> {
  const rows = await database
    .select({
      targetId: catalogTargets.id,
      bottleId: catalogTargets.bottleId,
    })
    .from(catalogTargets)
    .where(
      and(
        isNotNull(catalogTargets.bottleId),
        bottleIds?.length
          ? inArray(catalogTargets.bottleId, bottleIds)
          : undefined,
      ),
    )
    .orderBy(asc(catalogTargets.bottleId))
    .offset(offset)
    .limit(limit);

  return rows.map(({ targetId, bottleId }) => {
    if (bottleId === null) {
      throw new Error(`CatalogTarget ${targetId} is not an exact target`);
    }
    return { targetId, bottleId };
  });
}
