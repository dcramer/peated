import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { routerClient } from "@peated/server/orpc/router";
import {
  BottleReleaseSchema,
  BottleSchema,
  EntitySchema,
  UserSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";

const SearchResultSchema = z.union([
  z.object({
    type: z.literal("bottle"),
    ref: BottleSchema,
  }),
  z.object({
    type: z.literal("bottling"),
    ref: BottleReleaseSchema,
    bottle: BottleSchema,
  }),
  z.object({
    type: z.literal("entity"),
    ref: EntitySchema,
  }),
  z.object({
    type: z.literal("user"),
    ref: UserSchema,
  }),
]);

type Result = z.infer<typeof SearchResultSchema>;

type RankedResult = Result & {
  exactAliasMatch?: boolean;
};

const INCLUDE_LIST = ["bottles", "bottlings", "entities", "users"] as const;

/** Promotes exact targets while preserving each source's rank among ties. */
function sortResults(query: string, unsortedResults: RankedResult[]) {
  const lowerQuery = query.toLowerCase();

  const isExactMatch = (value: RankedResult) => {
    if (value.exactAliasMatch) return true;
    if (value.type === "entity") {
      return (
        value.ref.name.toLowerCase() === lowerQuery ||
        value.ref.shortName?.toLowerCase() === lowerQuery
      );
    }
    if (value.type === "user") {
      return value.ref.username.toLowerCase() === lowerQuery;
    }
    if (value.type === "bottling") {
      return (
        value.ref.fullName.toLowerCase() === lowerQuery ||
        value.ref.name.toLowerCase() === lowerQuery
      );
    }
    return (
      value.ref.fullName.toLowerCase() === lowerQuery ||
      value.ref.name.toLowerCase() === lowerQuery
    );
  };

  return unsortedResults
    .map((result, index) => ({ result, index, exact: isExactMatch(result) }))
    .sort((left, right) => {
      if (left.exact !== right.exact) return left.exact ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ result }) => result);
}

/** Aggregates global search while preserving exact bottle-release identity. */
export default procedure
  .route({
    method: "GET",
    path: "/search",
    summary: "Global search",
    description:
      "Search across bottles, bottlings, entities, and users with configurable result types and limits",
    spec: (spec) => ({
      ...spec,
      operationId: "search",
    }),
  })
  .input(
    z.object({
      query: z.coerce.string(),
      include: z.array(z.enum(INCLUDE_LIST)).default([...INCLUDE_LIST]),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      query: z.string(),
      results: z.array(SearchResultSchema),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { query, include, limit } = input;
    const promises: Promise<RankedResult[]>[] = [];

    if (include.includes("bottles")) {
      promises.push(
        routerClient.bottles
          .list(
            {
              query,
              cursor: 1,
              limit,
              sort: "rank",
            },
            { context },
          )
          .then((data: any) =>
            data.results.map((b: any) => ({ type: "bottle", ref: b })),
          )
          .catch(() => []),
      );
    }

    if (include.includes("bottlings") && query) {
      promises.push(
        (async () => {
          // Accepted release aliases carry an exact target that FTS cannot infer.
          const exactAliasReleaseIds = (
            await db
              .selectDistinct({ releaseId: bottleAliases.releaseId })
              .from(bottleAliases)
              .where(
                and(
                  eq(sql`LOWER(${bottleAliases.name})`, query.toLowerCase()),
                  sql`${bottleAliases.ignored} IS DISTINCT FROM TRUE`,
                  isNotNull(bottleAliases.releaseId),
                ),
              )
          )
            .map((row) => row.releaseId)
            .filter((releaseId): releaseId is number => releaseId !== null);
          const exactAliasOrder = exactAliasReleaseIds.length
            ? [
                desc(
                  sql<number>`CASE WHEN ${inArray(
                    bottleReleases.id,
                    exactAliasReleaseIds,
                  )} THEN 1 ELSE 0 END`,
                ),
              ]
            : [];

          const releaseList = await db
            .select()
            .from(bottleReleases)
            .where(
              or(
                sql`${bottleReleases.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
                exactAliasReleaseIds.length
                  ? inArray(bottleReleases.id, exactAliasReleaseIds)
                  : undefined,
              ),
            )
            .orderBy(
              ...exactAliasOrder,
              desc(
                sql`ts_rank(${bottleReleases.searchVector}, websearch_to_tsquery('english', ${query}))`,
              ),
              desc(bottleReleases.totalTastings),
            )
            .limit(limit);

          if (!releaseList.length) return [];

          const bottleIds = [
            ...new Set(releaseList.map((row) => row.bottleId)),
          ];
          const bottleList = await db
            .select()
            .from(bottles)
            .where(inArray(bottles.id, bottleIds));
          const [serializedBottles, serializedBottlings] = await Promise.all([
            serialize(BottleSerializer, bottleList, context.user ?? undefined),
            serialize(
              BottleReleaseSerializer,
              releaseList,
              context.user ?? undefined,
            ),
          ]);
          const bottlesById = new Map(
            serializedBottles.map((bottle) => [bottle.id, bottle]),
          );
          const exactAliasReleaseIdSet = new Set(exactAliasReleaseIds);

          return serializedBottlings.map((bottling) => {
            const bottle = bottlesById.get(bottling.bottleId)!;
            return {
              type: "bottling" as const,
              ref: bottling,
              bottle,
              exactAliasMatch: exactAliasReleaseIdSet.has(bottling.id),
            };
          });
        })().catch(() => []),
      );
    }

    if (include.includes("users")) {
      promises.push(
        routerClient.users
          .list(
            {
              query,
              cursor: 1,
              sort: "name",
              limit,
            },
            { context },
          )
          .then((data: any) =>
            data.results.map((b: any) => ({ type: "user", ref: b })),
          )
          .catch(() => []),
      );
    }

    if (include.includes("entities")) {
      promises.push(
        routerClient.entities
          .list(
            {
              query,
              cursor: 1,
              limit,
              sort: "rank",
            },
            { context },
          )
          .then((data: any) =>
            data.results.map((b: any) => ({ type: "entity", ref: b })),
          )
          .catch(() => []),
      );
    }

    const results = await Promise.all(promises);

    const sortedResults = sortResults(
      query,
      results.reduce<RankedResult[]>((prev, cur) => [...prev, ...cur], []),
    );

    return {
      query,
      results: sortedResults.slice(0, limit).map((result) => {
        const { exactAliasMatch: _exactAliasMatch, ...publicResult } = result;
        return publicResult;
      }),
    };
  });
