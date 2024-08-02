import type { SQL } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type AnyDatabase } from "../../db";
import type { BadgeAward } from "../../db/schema";
import {
  badgeAwards,
  badgeAwardTrackedObjects,
  bottles,
  bottlesToDistillers,
  entities,
  tastingBadgeAwards,
  tastings,
  type Badge,
} from "../../db/schema";
import type { BadgeCheckType, BadgeFormula, BadgeTracker } from "../../types";
import { AgeCheck } from "./checks/ageCheck";
import type { Check } from "./checks/base";
import { BottleCheck } from "./checks/bottleCheck";
import { CategoryCheck } from "./checks/categoryCheck";
import { EntityCheck } from "./checks/entityCheck";
import { EveryTastingCheck } from "./checks/everyTastingCheck";
import { RegionCheck } from "./checks/regionCheck";
import type { Tracker } from "./trackers/base";
import { BottleTracker } from "./trackers/bottle";
import { CountryTracker } from "./trackers/country";
import { EntityTracker } from "./trackers/entity";
import { RegionTracker } from "./trackers/region";
import { type TastingWithRelations, type TrackedObject } from "./types";

export function getCheckImpl(type: BadgeCheckType): Check {
  switch (type) {
    case "age":
      return new AgeCheck();
    case "bottle":
      return new BottleCheck();
    case "category":
      return new CategoryCheck();
    case "entity":
      return new EntityCheck();
    case "region":
      return new RegionCheck();
    case "everyTasting":
      return new EveryTastingCheck();

    default:
      throw new Error(`Invalid type: ${type}`);
  }
}

export function getTrackerImpl(type: BadgeTracker): Tracker {
  switch (type) {
    case "bottle":
      return new BottleTracker();
    case "entity":
      return new EntityTracker();
    case "region":
      return new RegionTracker();
    case "country":
      return new CountryTracker();
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}

export function getFormulaImpl(
  type: BadgeFormula,
): (totalXp: number, maxLevel: number) => number | null {
  switch (type) {
    case "default":
      return defaultCalculateLevel;
    case "linear":
      return linearCalculateLevel;
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}

// TODO(dcramer): at some point we'll want to cache this/optimize the db layer
// but for now its probably fine
export async function awardAllBadgeXp(
  db: AnyDatabase,
  tasting: TastingWithRelations,
) {
  const results: (BadgeAward & {
    prevLevel: number;
    badge: Badge;
  })[] = [];

  const badgeList = await db.query.badges.findMany();
  for (const badge of badgeList) {
    const award = await awardXp(db, tasting, badge);
    if (award)
      results.push({
        ...award,
        badge,
      });
  }
  return results;
}

export async function rescanBadge(badge: Badge) {
  // we need to identify any tastings that could qualify for this badge,
  // make sure the tracked objects exist, and award xp/levels as needed
  // the lazy way out is awardXp() on each tasting, but itll be slow

  const checks = await Promise.all(
    badge.checks.map(async ({ type, config }) => {
      const impl = getCheckImpl(type);
      return {
        impl,
        type,
        config: await impl.parseConfig(config),
      };
    }),
  );

  const where: SQL[] = [];
  for (const { impl, config } of checks) {
    where.push(...impl.buildWhereClause(config));
  }

  const brandT = alias(entities, "brand");
  const bottlerT = alias(entities, "bottler");

  const baseQuery = db
    .select()
    .from(tastings)
    .innerJoin(bottles, eq(bottles.id, tastings.bottleId))
    .innerJoin(brandT, eq(brandT.id, bottles.brandId))
    .leftJoin(bottlerT, eq(bottlerT.id, bottles.bottlerId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(tastings.id);

  const distillerT = alias(entities, "distiller");
  const baseDistillerQuery = db
    .select()
    .from(bottlesToDistillers)
    .innerJoin(distillerT, eq(bottlesToDistillers.distillerId, distillerT.id));

  // this query could be massively optimized to remove a ton of bandwidth use
  let offset = 0;
  let hasResults = true;
  while (hasResults) {
    const results = await baseQuery.limit(100).offset(offset);

    if (!results.length) {
      hasResults = false;
      break;
    }

    // pull in distillers
    const distillerQuery = await baseDistillerQuery.where(
      inArray(
        bottlesToDistillers.bottleId,
        results.map(({ bottle }) => bottle.id),
      ),
    );

    offset += results.length;

    for (const { tasting, brand, bottler, bottle } of results) {
      console.info(`[badges] Backfill XP for tasting ${tasting.id}`);
      await awardXp(
        db,
        {
          ...tasting,
          bottle: {
            ...bottle,
            brand,
            bottler,
            bottlesToDistillers: distillerQuery
              .filter(
                ({ bottle_distiller }) =>
                  bottle_distiller.bottleId === bottle.id,
              )
              .map(({ bottle_distiller, distiller }) => ({
                ...bottle_distiller,
                distiller,
              })),
          },
        },
        badge,
      );
    }
  }
}

// TODO: make this type safe
export async function checkBadgeConfig(type: BadgeCheckType, config: unknown) {
  const impl = getCheckImpl(type);
  return await impl.parseConfig(config);
}

async function awardXp(
  db: AnyDatabase,
  tasting: TastingWithRelations,
  badge: Badge,
) {
  console.info(`[badges] Checking badge ${badge.id} for ${tasting.id}`);

  const checks = await Promise.all(
    badge.checks.map(async ({ type, config }) => {
      const impl = getCheckImpl(type);
      return {
        impl,
        type,
        config: await impl.parseConfig(config),
      };
    }),
  );

  const trackedObjects: TrackedObject[] = [];
  for (const check of checks) {
    if (!check.impl.test(check.config, tasting)) {
      console.info(`[badges] Badge ${badge.id} did not test successfully.`);
      return;
    }
  }

  const tracker = getTrackerImpl(badge.tracker);
  for (const t of tracker.track(tasting)) {
    if (!trackedObjects.find((o) => o.type === t.type && o.id === t.id)) {
      trackedObjects.push(t);
    }
  }

  if (!trackedObjects.length) {
    console.info(`[badges] Badge ${badge.id} did not track any objects.`);
    return;
  }

  return await db.transaction(async (tx) => {
    let [award] = await tx
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
          throw new Error("wtf");
        }
      }
    }

    // there were no new entries
    if (!count) {
      console.info(`[badges] Already tracked objects for badge ${badge.id}.`);
      return;
    }

    console.info(`[badges] Awarding ${count} xp for badge ${badge.id}.`);

    [award] = await tx
      .update(badgeAwards)
      .set({
        xp: sql`${badgeAwards.xp} + ${count}`,
      })
      .where(eq(badgeAwards.id, award.id))
      .returning();

    // The amount of XP for a given level is defined as:
    // 0.02 * LEVEL**2 + 0.5 * LEVEL + 4

    const formula = getFormulaImpl(badge.formula);
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

// TODO: use math here so perf is better
/**
 * Quadratic formula with increasing difficulty for future levels.
 */
export function defaultCalculateLevel(
  totalXp: number,
  maxLevel: number,
): number | null {
  const a = 0.02;
  const b = 0.5;
  const c = 4;

  let level = 0;
  let requiredXp = 0;
  while (requiredXp <= totalXp && level < maxLevel + 1) {
    level++;
    requiredXp += a * Math.pow(level, 2) + b * level + c;
  }

  return level - 1;
}

/**
 * Linear formula with fixed difficulty for each level.
 */
export function linearCalculateLevel(
  totalXp: number,
  maxLevel: number,
): number | null {
  const xpPerLevel = 5;
  return Math.min(Math.floor(totalXp / xpPerLevel), maxLevel);
}
