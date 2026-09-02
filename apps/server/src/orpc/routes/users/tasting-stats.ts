import { EMPTY_TASTING_BAND_COUNTS } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { implement } from "@peated/server/orpc";
import userTastingStatsContract from "@peated/server/orpc/contracts/users/tasting-stats";
import type { Entity } from "@peated/server/types";
import { eq, inArray } from "drizzle-orm";
import { buildAgeStats } from "./age-stats";
import {
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

function incrementCount(counts: Map<number, number>, id: number) {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function rankProducers(
  counts: Map<number, number>,
  entitiesById: Map<number, Pick<Entity, "id" | "name" | "kind">>,
) {
  return Array.from(counts, ([id, count]) => {
    const entity = entitiesById.get(id);
    if (!entity) throw new Error(`Bottle references missing Entity ${id}.`);
    return { id, name: entity.name, kind: entity.kind, count };
  })
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    )
    .slice(0, 5);
}

export default implement(userTastingStatsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const user = await getUserFromId(db, input.user, context.user);
  if (!user) {
    throw errors.NOT_FOUND({
      message: "User not found.",
    });
  }

  if (!(await profileVisible(db, user, context.user))) {
    throw errors.BAD_REQUEST({
      message: "User's profile is private.",
    });
  }

  const ages: number[] = [];
  const bottleCounts = new Map<number, number>();
  const brandCounts = new Map<number, number>();
  const bottlerCounts = new Map<number, number>();
  const distillerCounts = new Map<number, number>();
  const bands = { total: 0, ...EMPTY_TASTING_BAND_COUNTS };
  let total = 0;
  let unstatedCount = 0;

  try {
    for await (const rows of scanUserTastingBottles(user.id)) {
      total += rows.length;
      const bottleIds = Array.from(
        new Set(rows.flatMap(({ bottle }) => (bottle ? [bottle.id] : []))),
      );
      const distillerRows = bottleIds.length
        ? await db
            .select()
            .from(bottlesToDistillers)
            .where(inArray(bottlesToDistillers.bottleId, bottleIds))
        : [];
      const distillerIdsByBottleId = new Map<number, number[]>();
      for (const { bottleId, distillerId } of distillerRows) {
        const ids = distillerIdsByBottleId.get(bottleId) ?? [];
        ids.push(distillerId);
        distillerIdsByBottleId.set(bottleId, ids);
      }

      for (const { bottle, ratingBand } of rows) {
        if (ratingBand !== null) {
          bands[ratingBand] += 1;
          bands.total += 1;
        }

        if (bottle) {
          bottleCounts.set(bottle.id, (bottleCounts.get(bottle.id) ?? 0) + 1);
          incrementCount(brandCounts, bottle.brandId);
          if (bottle.bottlerId !== null) {
            incrementCount(bottlerCounts, bottle.bottlerId);
          }
          for (const distillerId of distillerIdsByBottleId.get(bottle.id) ??
            []) {
            incrementCount(distillerCounts, distillerId);
          }
        }
        if (bottle?.statedAge === null || !bottle) {
          unstatedCount += 1;
        } else {
          ages.push(bottle.statedAge);
        }
      }
    }
  } catch (error) {
    if (error instanceof UserBottleReadIntegrityError) {
      throw errors.CONFLICT({ message: error.message, cause: error });
    }
    throw error;
  }

  const [mostTastedBottleId, mostTastedCount] = Array.from(bottleCounts)
    .filter(([, count]) => count > 1)
    .sort(
      ([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount || leftId - rightId,
    )[0] ?? [null, 0];
  const mostTastedBottle =
    mostTastedBottleId === null
      ? null
      : await db.query.bottles.findFirst({
          where: eq(bottles.id, mostTastedBottleId),
          with: { brand: true, group: true, series: true },
        });
  const producerIds = Array.from(
    new Set([
      ...brandCounts.keys(),
      ...bottlerCounts.keys(),
      ...distillerCounts.keys(),
    ]),
  );
  const producerEntities = producerIds.length
    ? await db
        .select({ id: entities.id, name: entities.name, kind: entities.kind })
        .from(entities)
        .where(inArray(entities.id, producerIds))
    : [];
  const producersById = new Map(
    producerEntities.map((entity) => [entity.id, entity]),
  );

  return {
    total,
    uniqueBottles: bottleCounts.size,
    bands,
    producers: {
      brands: rankProducers(brandCounts, producersById),
      bottlers: rankProducers(bottlerCounts, producersById),
      distillers: rankProducers(distillerCounts, producersById),
    },
    mostTastedBottle: mostTastedBottle
      ? {
          id: mostTastedBottle.id,
          name: formatBottleDisplayName(mostTastedBottle),
          count: mostTastedCount,
        }
      : null,
    age: buildAgeStats(ages, unstatedCount),
  };
});
