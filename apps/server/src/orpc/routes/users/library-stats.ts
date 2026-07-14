import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  bottlesToDistillers,
  collectionBottles,
  entities,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { getReservedCollection } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import { CategoryEnum } from "@peated/server/schemas";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

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

const emptyStats = {
  total: 0,
  distillers: [],
  age: {
    knownCount: 0,
    median: null,
    oldest: null,
    buckets: [
      { id: "under10" as const, label: "Under 10", count: 0 },
      { id: "from10To12" as const, label: "10–12", count: 0 },
      { id: "from13To17" as const, label: "13–17", count: 0 },
      { id: "from18To24" as const, label: "18–24", count: 0 },
      { id: "atLeast25" as const, label: "25+", count: 0 },
      { id: "unstated" as const, label: "Unstated", count: 0 },
    ],
  },
  categories: [],
};

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
  .output(
    z.object({
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
    }),
  )
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

    const nonEmptyLibraryEntry = and(
      eq(collectionBottles.collectionId, library.id),
      sql`${collectionBottles.status} IS DISTINCT FROM 'empty'`,
    );
    const statedAge = sql<number>`COALESCE(${bottleReleases.statedAge}, ${bottles.statedAge})`;

    const [ageRows, distillerRows, categoryRows] = await Promise.all([
      db
        .select({
          total: sql<string>`COUNT(${collectionBottles.id})`,
          knownCount: sql<string>`COUNT(${statedAge})`,
          median: sql<
            string | null
          >`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${statedAge}) FILTER (WHERE ${statedAge} IS NOT NULL)`,
          oldest: sql<number | null>`MAX(${statedAge})`,
          under10: sql<string>`COUNT(*) FILTER (WHERE ${statedAge} < 10)`,
          from10To12: sql<string>`COUNT(*) FILTER (WHERE ${statedAge} BETWEEN 10 AND 12)`,
          from13To17: sql<string>`COUNT(*) FILTER (WHERE ${statedAge} BETWEEN 13 AND 17)`,
          from18To24: sql<string>`COUNT(*) FILTER (WHERE ${statedAge} BETWEEN 18 AND 24)`,
          atLeast25: sql<string>`COUNT(*) FILTER (WHERE ${statedAge} >= 25)`,
          unstated: sql<string>`COUNT(*) FILTER (WHERE ${statedAge} IS NULL)`,
        })
        .from(collectionBottles)
        .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
        .leftJoin(
          bottleReleases,
          eq(bottleReleases.id, collectionBottles.releaseId),
        )
        .where(nonEmptyLibraryEntry),
      db
        .select({
          id: entities.id,
          name: entities.name,
          count: sql<string>`COUNT(${collectionBottles.id})`,
        })
        .from(collectionBottles)
        .innerJoin(
          bottlesToDistillers,
          eq(bottlesToDistillers.bottleId, collectionBottles.bottleId),
        )
        .innerJoin(entities, eq(entities.id, bottlesToDistillers.distillerId))
        .where(nonEmptyLibraryEntry)
        .groupBy(entities.id, entities.name)
        .orderBy(desc(sql`COUNT(${collectionBottles.id})`), asc(entities.name))
        .limit(5),
      db
        .select({
          category: bottles.category,
          count: sql<string>`COUNT(${collectionBottles.id})`,
        })
        .from(collectionBottles)
        .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
        .where(and(nonEmptyLibraryEntry, isNotNull(bottles.category)))
        .groupBy(bottles.category)
        .orderBy(
          desc(sql`COUNT(${collectionBottles.id})`),
          asc(bottles.category),
        )
        .limit(5),
    ]);

    const age = ageRows[0];
    if (!age) {
      return emptyStats;
    }

    return {
      total: Number(age.total),
      distillers: distillerRows.map((row) => ({
        id: row.id,
        name: row.name,
        count: Number(row.count),
      })),
      age: {
        knownCount: Number(age.knownCount),
        median: age.median === null ? null : Number(age.median),
        oldest: age.oldest === null ? null : Number(age.oldest),
        buckets: [
          { id: "under10", label: "Under 10", count: Number(age.under10) },
          {
            id: "from10To12",
            label: "10–12",
            count: Number(age.from10To12),
          },
          {
            id: "from13To17",
            label: "13–17",
            count: Number(age.from13To17),
          },
          {
            id: "from18To24",
            label: "18–24",
            count: Number(age.from18To24),
          },
          {
            id: "atLeast25",
            label: "25+",
            count: Number(age.atLeast25),
          },
          {
            id: "unstated",
            label: "Unstated",
            count: Number(age.unstated),
          },
        ],
      },
      categories: categoryRows.flatMap((row) =>
        row.category
          ? [{ category: row.category, count: Number(row.count) }]
          : [],
      ),
    };
  });
