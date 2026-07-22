import { db, type AnyDatabase } from "@peated/server/db";
import type { BadgeAward } from "@peated/server/db/schema";
import {
  badgeAwards,
  badgeAwardTrackedObjects,
  tastingBadgeAwards,
  tastings,
  type Badge,
} from "@peated/server/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { logInfo } from "../log";
import { prepareBadgeCheck, type PreparedBadgeCheck } from "./checks";
import { getFormula } from "./formula";
import { loadBadgeTastings } from "./identity";
import { getTracker } from "./trackers";
import type {
  BadgeTasting,
  PersistedBadgeTasting,
  TrackedObject,
} from "./types";

const BADGE_RESCAN_BATCH_SIZE = 200;

function prepareBadgeChecks(badge: Badge): PreparedBadgeCheck[] {
  return badge.checks.map(prepareBadgeCheck);
}

export async function awardAllBadgeXp(
  database: AnyDatabase,
  tasting: PersistedBadgeTasting,
) {
  const results: (BadgeAward & {
    prevLevel: number;
    badge: Badge;
  })[] = [];
  const [hydratedTasting] = await loadBadgeTastings(database, [tasting], {
    caller: "badges.awardAllBadgeXp",
    operation: "award",
  });
  if (!hydratedTasting) throw new Error("Missing hydrated badge Tasting");

  const badgeList = await database.query.badges.findMany();
  for (const badge of badgeList) {
    const checks = prepareBadgeChecks(badge);
    const award = await awardXp(database, hydratedTasting, badge, checks);
    if (award)
      results.push({
        ...award,
        badge,
      });
  }
  return results;
}

export async function rescanBadge(
  badge: Badge,
  database: AnyDatabase = db,
): Promise<void> {
  const checks = prepareBadgeChecks(badge);
  let afterId: number | null = null;

  while (true) {
    const tastingRows = await database
      .select({
        id: tastings.id,
        createdById: tastings.createdById,
        targetId: tastings.targetId,
        bottleId: tastings.bottleId,
        releaseId: tastings.releaseId,
      })
      .from(tastings)
      .where(afterId === null ? undefined : gt(tastings.id, afterId))
      .orderBy(tastings.id)
      .limit(BADGE_RESCAN_BATCH_SIZE);
    if (tastingRows.length === 0) break;

    const hydratedTastings = await loadBadgeTastings(database, tastingRows, {
      caller: "badges.rescanBadge",
      operation: "rescan",
    });
    for (const tasting of hydratedTastings) {
      logInfo("Backfilling badge XP for tasting {tastingId}", {
        extra: {
          tastingId: tasting.id,
        },
      });
      await awardXp(database, tasting, badge, checks);
    }

    afterId = tastingRows.at(-1)!.id;
    if (tastingRows.length < BADGE_RESCAN_BATCH_SIZE) break;
  }
}

async function awardXp(
  database: AnyDatabase,
  tasting: BadgeTasting,
  badge: Badge,
  checks: PreparedBadgeCheck[],
) {
  logInfo("Checking badge {badgeId} for tasting {tastingId}", {
    extra: {
      badgeId: badge.id,
      tastingId: tasting.id,
    },
  });

  const trackedObjects: TrackedObject[] = [];
  for (const check of checks) {
    if (!check.test(tasting)) {
      logInfo("Badge {badgeId} did not test successfully", {
        extra: {
          badgeId: badge.id,
          tastingId: tasting.id,
        },
      });
      return;
    }
  }

  const tracker = getTracker(badge.tracker);
  for (const t of tracker.track(tasting)) {
    if (!trackedObjects.find((o) => o.type === t.type && o.id === t.id)) {
      trackedObjects.push(t);
    }
  }

  if (!trackedObjects.length) {
    logInfo("Badge {badgeId} did not track any objects", {
      extra: {
        badgeId: badge.id,
        tastingId: tasting.id,
      },
    });
    return;
  }

  return await database.transaction(async (tx) => {
    const [initialAward] = await tx
      .insert(badgeAwards)
      .values({
        badgeId: badge.id,
        userId: tasting.createdById,
        xp: 0,
        level: 0,
      })
      // HACK: force an update so returning() works
      .onConflictDoUpdate({
        target: [badgeAwards.badgeId, badgeAwards.userId],
        set: {
          badgeId: badge.id,
        },
      })
      .returning();
    if (!initialAward) {
      throw new Error(`Unable to load badge award for badge ${badge.id}`);
    }
    let award = initialAward;

    let count = 0;
    for (const target of trackedObjects) {
      const query = await tx
        .insert(badgeAwardTrackedObjects)
        .values({
          awardId: award.id,
          objectType: target.type,
          objectId: target.id,
        })
        .onConflictDoNothing();
      if (query.rowCount) {
        count += query.rowCount;
        if (query.rowCount > 1) {
          throw new Error(
            `Tracked-object insert affected ${query.rowCount} rows for badge award ${award.id}`,
          );
        }
      }
    }

    // there were no new entries
    if (!count) {
      logInfo("Already tracked objects for badge {badgeId}", {
        extra: {
          badgeId: badge.id,
          tastingId: tasting.id,
        },
      });
      return;
    }

    logInfo("Awarding badge XP for badge {badgeId}", {
      extra: {
        badgeId: badge.id,
        tastingId: tasting.id,
        xp: count,
      },
    });

    const [updatedAward] = await tx
      .update(badgeAwards)
      .set({
        xp: sql`${badgeAwards.xp} + ${count}`,
      })
      .where(eq(badgeAwards.id, award.id))
      .returning();
    if (!updatedAward) {
      throw new Error(`Unable to update badge award ${award.id}`);
    }
    award = updatedAward;

    // The amount of XP for a given level is defined as:
    // 0.02 * LEVEL**2 + 0.5 * LEVEL + 4

    const formula = getFormula(badge.formula);
    const newLevel = formula(award.xp, badge.maxLevel) ?? award.level;

    if (newLevel !== award.level) {
      const result = await tx
        .update(badgeAwards)
        .set({
          level: newLevel,
        })
        .where(
          and(eq(badgeAwards.id, award.id), eq(badgeAwards.level, award.level)),
        );
      if (!result.rowCount) {
        throw new Error("We seemed to have hit a db race condition");
      }
      await tx.insert(tastingBadgeAwards).values({
        tastingId: tasting.id,
        awardId: award.id,
        level: newLevel,
      });
    }

    return {
      ...award,
      level: newLevel,
      prevLevel: award.level,
    };
  });
}
