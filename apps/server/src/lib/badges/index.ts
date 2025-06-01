import { type AnyDatabase, db } from "@peated/server/db";
import type { BadgeAward } from "@peated/server/db/schema";
import {
  type Badge,
  badgeAwardTrackedObjects,
  badgeAwards,
  bottles,
  bottlesToDistillers,
  entities,
  tastingBadgeAwards,
  tastings,
} from "@peated/server/db/schema";
import type { SQL } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { BadgeCheckType } from "../../types";
import { getCheck } from "./checks";
import { getFormula } from "./formula";
import { getTracker } from "./trackers";
import type { TastingWithRelations, TrackedObject } from "./types";

// TODO(dcramer): at some point we'll want to cache this/optimize the db layer
// but for now its probably fine
export async function awardAllBadgeXp(
  db: AnyDatabase,
  tasting: TastingWithRelations
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
      const impl = getCheck(type);
      return {
        impl,
        type,
        config: await impl.parseConfig(config),
      };
    })
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
        results.map(({ bottle }) => bottle.id)
      )
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
                  bottle_distiller.bottleId === bottle.id
              )
              .map(({ bottle_distiller, distiller }) => ({
                ...bottle_distiller,
                distiller,
              })),
          },
        },
        badge
      );
    }
  }
}

// TODO: make this type safe
export async function checkBadgeConfig(type: BadgeCheckType, config: unknown) {
  const impl = getCheck(type);
  return await impl.parseConfig(config);
}

async function awardXp(
  db: AnyDatabase,
  tasting: TastingWithRelations,
  badge: Badge
) {
  console.info(`[badges] Checking badge ${badge.id} for ${tasting.id}`);

  const checks = await Promise.all(
    badge.checks.map(async ({ type, config }) => {
      const impl = getCheck(type);
      return {
        impl,
        type,
        config: await impl.parseConfig(config),
      };
    })
  );

  const trackedObjects: TrackedObject[] = [];
  for (const check of checks) {
    if (!check.impl.test(check.config, tasting)) {
      console.info(`[badges] Badge ${badge.id} did not test successfully.`);
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

    const formula = getFormula(badge.formula);
    const newLevel = formula(award.xp, badge.maxLevel) ?? award.level;

    if (newLevel !== award.level) {
      const result = await tx
        .update(badgeAwards)
        .set({
          level: newLevel,
        })
        .where(
          and(eq(badgeAwards.id, award.id), eq(badgeAwards.level, award.level))
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
