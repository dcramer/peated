import type { BadgeType } from "../../types";

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
import { AgeCheck } from "./ageCheck";
import {
  defaultCalculateLevel,
  type TastingWithRelations,
  type TrackedObject,
} from "./base";
import { BottleCheck } from "./bottleCheck";
import { CategoryCheck } from "./categoryCheck";
import { EntityCheck } from "./entityCheck";
import { EveryTastingCheck } from "./everyTastingCheck";
import { RegionCheck } from "./regionCheck";

export function getBadgeImpl(type: BadgeType) {
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
      throw new Error(`Invalid badge type: ${type}`);
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
      const impl = getBadgeImpl(type);
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
    .where(where ? and(...where) : where)
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
export async function checkBadgeConfig(type: BadgeType, config: unknown) {
  const impl = getBadgeImpl(type);
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
      const impl = getBadgeImpl(type);
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
    for (const t of check.impl.track(check.config, tasting)) {
      if (!trackedObjects.find((o) => o.type === t.type && o.id === t.id)) {
        trackedObjects.push(t);
      }
    }
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
    if (trackedObjects.length) {
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
    } else {
      count += 1;
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

    const newLevel =
      defaultCalculateLevel(award.xp, badge.maxLevel) ?? award.level;

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
