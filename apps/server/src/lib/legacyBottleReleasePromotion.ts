import type { AnyDatabase } from "@peated/server/db";
import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  bottleTombstones,
} from "@peated/server/db/schema";
import { logInfo } from "@peated/server/lib/log";
import { and, eq } from "drizzle-orm";

export type LegacyBottleReleasePromotionErrorCode =
  | "parent_mismatch"
  | "promoted_bottle_unavailable"
  | "promotion_incomplete"
  | "promotion_integrity_mismatch"
  | "release_not_found";

export class LegacyBottleReleasePromotionError extends Error {
  constructor(
    readonly code: LegacyBottleReleasePromotionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LegacyBottleReleasePromotionError";
  }
}

type CompatibilityContext = {
  access: "read" | "write";
  caller: string;
  operation: string;
};

/**
 * Resolves one retained BottleRelease through its completed promotion mapping.
 * This compatibility boundary returns only the independently complete Bottle.
 */
export async function resolveLegacyBottleReleasePromotion(
  {
    releaseId,
    expectedParentBottleId,
    context,
  }: {
    releaseId: number;
    expectedParentBottleId?: number;
    context: CompatibilityContext;
  },
  database: AnyDatabase = db,
) {
  const release = await database.query.bottleReleases.findFirst({
    where: eq(bottleReleases.id, releaseId),
    columns: {
      id: true,
      bottleId: true,
    },
  });

  if (!release) {
    throw new LegacyBottleReleasePromotionError(
      "release_not_found",
      "Release not found.",
    );
  }

  logInfo("Legacy BottleRelease compatibility access", {
    extra: {
      event: "bottle_release.compatibility",
      access: context.access,
      caller: context.caller,
      operation: context.operation,
      legacyBottleId: release.bottleId,
      releaseId: release.id,
    },
  });

  if (expectedParentBottleId !== undefined) {
    const parentMatches = release.bottleId === expectedParentBottleId;
    const parentWasMergedIntoCurrent = parentMatches
      ? undefined
      : await database.query.bottleTombstones.findFirst({
          where: and(
            eq(bottleTombstones.bottleId, expectedParentBottleId),
            eq(bottleTombstones.newBottleId, release.bottleId),
          ),
          columns: { bottleId: true },
        });

    if (!parentMatches && !parentWasMergedIntoCurrent) {
      throw new LegacyBottleReleasePromotionError(
        "parent_mismatch",
        "The release does not belong to the supplied parent Bottle.",
      );
    }
  }

  const promotion = await database.query.bottleReleasePromotions.findFirst({
    where: eq(bottleReleasePromotions.releaseId, release.id),
  });
  if (
    !promotion ||
    promotion.status !== "promoted" ||
    promotion.promotedBottleId === null ||
    promotion.completedAt === null
  ) {
    throw new LegacyBottleReleasePromotionError(
      "promotion_incomplete",
      "The release does not have a completed promotion mapping.",
    );
  }

  const promotedBottle = await database.query.bottles.findFirst({
    where: eq(bottles.id, promotion.promotedBottleId),
  });
  if (!promotedBottle) {
    throw new LegacyBottleReleasePromotionError(
      "promoted_bottle_unavailable",
      `Promoted Bottle ${promotion.promotedBottleId} is unavailable.`,
    );
  }
  if (promotedBottle.groupId === null) {
    throw new LegacyBottleReleasePromotionError(
      "promotion_integrity_mismatch",
      "Promotion integrity mismatch: the promoted Bottle has no group membership.",
    );
  }

  const [bottleTombstone, groupTombstone] = await Promise.all([
    database.query.bottleTombstones.findFirst({
      where: eq(bottleTombstones.bottleId, promotedBottle.id),
      columns: { bottleId: true },
    }),
    database.query.bottleGroupTombstones.findFirst({
      where: eq(bottleGroupTombstones.groupId, promotedBottle.groupId),
      columns: { groupId: true },
    }),
  ]);
  if (bottleTombstone || groupTombstone) {
    throw new LegacyBottleReleasePromotionError(
      "promoted_bottle_unavailable",
      `Promoted Bottle ${promotion.promotedBottleId} is unavailable.`,
    );
  }

  return {
    release: {
      id: release.id,
      bottleId: release.bottleId,
    },
    bottle: promotedBottle,
  };
}
