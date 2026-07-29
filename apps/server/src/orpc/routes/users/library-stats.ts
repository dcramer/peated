import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  collectionBottles,
  entities,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { getReservedCollection } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import { CategoryEnum } from "@peated/server/schemas";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  readJoinedUserBottle,
  type UserBottleRead,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

const LIBRARY_STATS_BATCH_SIZE = 200;

const AgeBucketSchema = z.object({
  id: z.enum([
    "under10",
    "from10To12",
    "from13To17",
    "from18To24",
    "atLeast25",
    "unstated",
  ]),
  label: z.string(),
  count: z.number(),
});

const LibraryStatsSchema = z.object({
  total: z.number(),
  distillers: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      count: z.number(),
    }),
  ),
  age: z.object({
    knownCount: z.number(),
    median: z.number().nullable(),
    oldest: z.number().nullable(),
    buckets: z.array(AgeBucketSchema),
  }),
  categories: z.array(
    z.object({
      category: CategoryEnum,
      count: z.number(),
    }),
  ),
});

type Category = z.infer<typeof CategoryEnum>;
type LibraryStats = z.infer<typeof LibraryStatsSchema>;
type LibraryStatsAccumulator = {
  total: number;
  ages: number[];
  oldestAge: number | null;
  categoryCounts: Map<Category, number>;
  distillerCounts: Map<number, number>;
  unstatedAgeCount: number;
};
type LibraryBottleRead = UserBottleRead & { distillerIds: number[] };

const emptyStats: LibraryStats = {
  total: 0,
  distillers: [],
  age: {
    knownCount: 0,
    median: null,
    oldest: null,
    buckets: [
      { id: "under10", label: "Under 10", count: 0 },
      { id: "from10To12", label: "10–12", count: 0 },
      { id: "from13To17", label: "13–17", count: 0 },
      { id: "from18To24", label: "18–24", count: 0 },
      { id: "atLeast25", label: "25+", count: 0 },
      { id: "unstated", label: "Unstated", count: 0 },
    ],
  },
  categories: [],
};

function incrementCount<TKey>(counts: Map<TKey, number>, key: TKey): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function createLibraryStatsAccumulator(): LibraryStatsAccumulator {
  return {
    total: 0,
    ages: [],
    oldestAge: null,
    categoryCounts: new Map(),
    distillerCounts: new Map(),
    unstatedAgeCount: 0,
  };
}

function accumulateLibraryStats(
  accumulator: LibraryStatsAccumulator,
  bottleList: Array<LibraryBottleRead | null>,
): void {
  accumulator.total += bottleList.length;

  for (const bottle of bottleList) {
    if (!bottle) {
      accumulator.unstatedAgeCount += 1;
      continue;
    }

    if (bottle.statedAge === null) {
      accumulator.unstatedAgeCount += 1;
    } else {
      accumulator.ages.push(bottle.statedAge);
      accumulator.oldestAge =
        accumulator.oldestAge === null
          ? bottle.statedAge
          : Math.max(accumulator.oldestAge, bottle.statedAge);
    }
    if (bottle.category !== null) {
      incrementCount(accumulator.categoryCounts, bottle.category);
    }
    for (const distillerId of bottle.distillerIds) {
      incrementCount(accumulator.distillerCounts, distillerId);
    }
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

async function finalizeLibraryStats(
  accumulator: LibraryStatsAccumulator,
): Promise<LibraryStats> {
  const distillerIds = Array.from(accumulator.distillerCounts.keys());
  const distillerList = distillerIds.length
    ? await db.query.entities.findMany({
        where: inArray(entities.id, distillerIds),
        columns: { id: true, name: true },
      })
    : [];
  const distillersById = new Map(
    distillerList.map((distiller) => [distiller.id, distiller]),
  );
  const distillers = Array.from(accumulator.distillerCounts, ([id, count]) => {
    const distiller = distillersById.get(id);
    if (!distiller) {
      throw new Error(`Bottle references missing distiller: ${id}`);
    }
    return { id, name: distiller.name, count };
  })
    .sort((left, right) =>
      right.count === left.count
        ? left.name.localeCompare(right.name)
        : right.count - left.count,
    )
    .slice(0, 5);
  const categories = Array.from(
    accumulator.categoryCounts,
    ([category, count]) => ({
      category,
      count,
    }),
  )
    .sort((left, right) =>
      right.count === left.count
        ? left.category.localeCompare(right.category)
        : right.count - left.count,
    )
    .slice(0, 5);

  return {
    total: accumulator.total,
    distillers,
    age: {
      knownCount: accumulator.ages.length,
      median: median(accumulator.ages),
      oldest: accumulator.oldestAge,
      buckets: [
        {
          id: "under10",
          label: "Under 10",
          count: accumulator.ages.filter((age) => age < 10).length,
        },
        {
          id: "from10To12",
          label: "10–12",
          count: accumulator.ages.filter((age) => age >= 10 && age <= 12)
            .length,
        },
        {
          id: "from13To17",
          label: "13–17",
          count: accumulator.ages.filter((age) => age >= 13 && age <= 17)
            .length,
        },
        {
          id: "from18To24",
          label: "18–24",
          count: accumulator.ages.filter((age) => age >= 18 && age <= 24)
            .length,
        },
        {
          id: "atLeast25",
          label: "25+",
          count: accumulator.ages.filter((age) => age >= 25).length,
        },
        {
          id: "unstated",
          label: "Unstated",
          count: accumulator.unstatedAgeCount,
        },
      ],
    },
    categories,
  };
}

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/library/stats",
    summary: "Get user Library statistics",
    description:
      "Retrieve distillery, age, and category insights for non-empty bottles in a visible user's Library",
    operationId: "getUserLibraryStats",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(LibraryStatsSchema)
  .handler(async function ({ input, context, errors }) {
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

    const library = await getReservedCollection(db, user.id, "library");
    if (!library) {
      return emptyStats;
    }

    try {
      const accumulator = createLibraryStatsAccumulator();
      let afterId: number | null = null;

      while (true) {
        const rows = await db
          .select({
            id: collectionBottles.id,
            storedBottleId: collectionBottles.bottleId,
            bottle: {
              id: bottles.id,
              groupId: bottles.groupId,
              brandId: bottles.brandId,
              category: bottles.category,
              flavorProfile: bottles.flavorProfile,
              statedAge: bottles.statedAge,
            },
            retiredBottleId: bottleTombstones.bottleId,
          })
          .from(collectionBottles)
          .leftJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
          .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
          .where(
            and(
              eq(collectionBottles.collectionId, library.id),
              sql`${collectionBottles.status} IS DISTINCT FROM 'empty'`,
              afterId === null ? undefined : gt(collectionBottles.id, afterId),
            ),
          )
          .orderBy(collectionBottles.id)
          .limit(LIBRARY_STATS_BATCH_SIZE);

        if (rows.length === 0) break;

        const directBottles = rows.map(readJoinedUserBottle);
        const bottleIds = Array.from(
          new Set(
            directBottles.flatMap((bottle) =>
              bottle === null ? [] : [bottle.id],
            ),
          ),
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
        accumulateLibraryStats(
          accumulator,
          directBottles.map((bottle) =>
            bottle === null
              ? null
              : {
                  ...bottle,
                  distillerIds: distillerIdsByBottleId.get(bottle.id) ?? [],
                },
          ),
        );

        afterId = rows.at(-1)!.id;
        if (rows.length < LIBRARY_STATS_BATCH_SIZE) break;
      }

      return await finalizeLibraryStats(accumulator);
    } catch (error) {
      if (error instanceof UserBottleReadIntegrityError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
