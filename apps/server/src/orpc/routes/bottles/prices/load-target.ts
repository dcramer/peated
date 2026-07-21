import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleReleases,
  storePrices,
} from "@peated/server/db/schema";
import { loadCatalogTargetByBottleId } from "@peated/server/lib/catalogTargets";
import { and, eq, sql, type SQL } from "drizzle-orm";

/** Resolves the exact target that owns Bottle-scoped price reads. */
export default async function loadBottlePriceTargetId(
  bottleId: number,
): Promise<number> {
  return (
    await loadCatalogTargetByBottleId(bottleId, {
      actor: null,
      permissions: { canReadCatalogIdentity: true },
    })
  ).targetId;
}

/**
 * Defines semantic legacy Bottle membership for read parity after release
 * promotion. A retained parent/release pair belongs to the promoted concrete
 * Bottle only when the release still belongs to that parent and its mapping is
 * complete.
 */
export function legacyStorePriceBottleMembership(
  bottleId: number,
): SQL<boolean> {
  return sql<boolean>`${storePrices.bottleId} = ${bottleId} OR exists(${db
    .select({ value: sql`1` })
    .from(bottleReleases)
    .innerJoin(
      bottleReleasePromotions,
      eq(bottleReleasePromotions.releaseId, bottleReleases.id),
    )
    .where(
      and(
        eq(bottleReleases.id, storePrices.releaseId),
        eq(bottleReleases.bottleId, storePrices.bottleId),
        eq(bottleReleasePromotions.status, "promoted"),
        eq(bottleReleasePromotions.promotedBottleId, bottleId),
      ),
    )})`;
}
