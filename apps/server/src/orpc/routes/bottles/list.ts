import { BOTTLE_AGE_BAND_LIST, CATEGORY_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  entities,
  entityFollows,
  flightBottles,
  flights,
  tastings,
} from "@peated/server/db/schema";
import {
  plainTextSearchQuery,
  prefixTextSearchQuery,
} from "@peated/server/lib/search";
import { implement } from "@peated/server/orpc";
import bottleListContract from "@peated/server/orpc/contracts/bottles/list";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";

type BottleAgeBand = (typeof BOTTLE_AGE_BAND_LIST)[number];

function ageBandFilter(ageBand: BottleAgeBand): SQL<unknown> {
  switch (ageBand) {
    case "nas":
      return sql`${bottles.noAgeStatement} IS TRUE`;
    case "under_12":
      return sql`${bottles.statedAge} < 12`;
    case "12_17":
      return sql`${bottles.statedAge} >= 12 AND ${bottles.statedAge} < 18`;
    case "18_24":
      return sql`${bottles.statedAge} >= 18 AND ${bottles.statedAge} < 25`;
    case "25_plus":
      return sql`${bottles.statedAge} >= 25`;
  }
}

export default implement(bottleListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const { query, cursor, limit, filter, category, ageBand, ...rest } = input;
  const offset = (cursor - 1) * limit;
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  const exactAliasBottleIds = query
    ? (
        await db
          .selectDistinct({ bottleId: bottleAliases.bottleId })
          .from(bottleAliases)
          .where(
            and(
              eq(sql`LOWER(${bottleAliases.name})`, query.toLowerCase()),
              sql`${bottleAliases.ignored} IS NOT TRUE`,
              isNotNull(bottleAliases.bottleId),
            ),
          )
      )
        .map((row) => row.bottleId)
        // Narrow type: isNotNull in query guarantees non-null at runtime
        .filter((bottleId): bottleId is number => bottleId !== null)
    : [];

  const where: (SQL<unknown> | undefined)[] = [];
  let followedDistillerIds: number[] | null = null;
  let hasUnknownFlight = false;
  where.push(isNotNull(bottles.groupId));
  where.push(
    sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
  );

  if (filter === "following") {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    followedDistillerIds = (
      await db
        .select({ entityId: entityFollows.entityId })
        .from(entityFollows)
        .innerJoin(entities, eq(entities.id, entityFollows.entityId))
        .where(
          and(
            eq(entityFollows.userId, context.user.id),
            eq(entities.kind, "distillery"),
          ),
        )
    ).map(({ entityId }) => entityId);
    where.push(
      followedDistillerIds.length
        ? sql`EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                AND ${inArray(
                  bottlesToDistillers.distillerId,
                  followedDistillerIds,
                )}
            )`
        : sql`FALSE`,
    );
  }

  if (query) {
    where.push(
      or(
        sql`${bottles.searchVector} @@ ${textQuery}`,
        sql`${bottles.searchVector} @@ ${prefixQuery}`,
        exactAliasBottleIds.length
          ? inArray(bottles.id, exactAliasBottleIds)
          : undefined,
      ),
    );
  }
  if (rest.brand) {
    where.push(eq(bottles.brandId, rest.brand));
  }
  if (rest.distiller) {
    where.push(
      sql`EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${rest.distiller} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
    );
  }
  if (rest.bottler) {
    where.push(eq(bottles.bottlerId, rest.bottler));
  }
  if (rest.entity) {
    where.push(
      or(
        eq(bottles.brandId, rest.entity),
        eq(bottles.bottlerId, rest.entity),
        sql`EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${rest.entity} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
      ),
    );
  }
  if (rest.series) {
    where.push(eq(bottles.seriesId, rest.series));
  }
  if (rest.flavorProfile) {
    where.push(eq(bottles.flavorProfile, rest.flavorProfile));
  }
  if (rest.age) {
    where.push(eq(bottles.statedAge, rest.age));
  }
  if (rest.tag) {
    where.push(
      sql`EXISTS(SELECT FROM ${tastings} WHERE ${rest.tag} = ANY(${tastings.tags}) AND ${tastings.bottleId} = ${bottles.id})`,
    );
  }
  if (rest.minScore !== null && rest.minScore !== undefined) {
    where.push(
      and(
        sql`${bottles.medianScore} IS NOT NULL`,
        sql`${bottles.medianScore} >= ${rest.minScore}`,
      ),
    );
  }

  if (rest.flight) {
    const [flight] = await db
      .select({ id: flights.id })
      .from(flights)
      .where(eq(flights.publicId, rest.flight));
    hasUnknownFlight = !flight;
    where.push(
      flight
        ? sql`EXISTS(SELECT FROM ${flightBottles} WHERE ${flightBottles.flightId} = ${flight.id} AND ${flightBottles.bottleId} = ${bottles.id})`
        : sql`FALSE`,
    );
  }

  const categoryWhere = category ? eq(bottles.category, category) : undefined;
  const ageBandWhere = ageBand ? ageBandFilter(ageBand) : undefined;
  const resultWhere = [...where, categoryWhere, ageBandWhere];

  let orderBy: SQL<unknown>;
  switch (rest.sort) {
    case "rank":
      if (query) {
        orderBy = sql`GREATEST(
            ts_rank(${bottles.searchVector}, ${textQuery}),
            ts_rank(${bottles.searchVector}, ${prefixQuery}) * 0.5
          ) DESC`;
      } else {
        orderBy = desc(bottles.totalTastings);
      }
      break;
    case "brand":
      if (!rest.entity) {
        throw errors.BAD_REQUEST({
          message: "Cannot sort by brand without entity filter.",
        });
      }
      orderBy = sql`${entities.name} ASC, ${bottles.name} ASC`;
      break;
    case "created":
      orderBy = asc(bottles.createdAt);
      break;
    case "-created":
      orderBy = desc(bottles.createdAt);
      break;
    case "name":
      orderBy = asc(bottles.fullName);
      break;
    case "-name":
      orderBy = desc(bottles.fullName);
      break;
    case "age":
      orderBy = sql`${bottles.statedAge} ASC NULLS FIRST`;
      break;
    case "-age":
      orderBy = sql`${bottles.statedAge} DESC NULLS LAST`;
      break;
    case "tastings":
      orderBy = asc(bottles.totalTastings);
      break;
    case "-release":
      orderBy = sql`
          COALESCE(${bottles.releaseYear}, EXTRACT(YEAR FROM ${bottles.createdAt})) DESC,
          ${bottles.releaseYear} IS NULL ASC,
          ${bottles.releaseDate} DESC NULLS LAST,
          ${bottles.createdAt} DESC NULLS LAST
        `;
      break;
    case "score":
      orderBy = sql`${bottles.medianScore} ASC NULLS LAST`;
      break;
    case "-score":
      orderBy = sql`${bottles.medianScore} DESC NULLS LAST`;
      break;
    case "-tastings":
    default:
      orderBy = desc(bottles.totalTastings);
  }

  const [results, [totalRow], categoryRows, [ageBandCounts]] =
    await Promise.all([
      db
        .select({ ...getTableColumns(bottles) })
        .from(bottles)
        .innerJoin(entities, eq(entities.id, bottles.brandId))
        .where(and(...resultWhere))
        .limit(limit + 1)
        .offset(offset)
        .orderBy(
          ...(exactAliasBottleIds.length
            ? [
                sql`CASE WHEN ${bottles.id} IN (${sql.join(
                  exactAliasBottleIds.map((bottleId) => sql`${bottleId}`),
                  sql`, `,
                )}) THEN 0 ELSE 1 END`,
                orderBy,
                asc(bottles.id),
              ]
            : [orderBy, asc(bottles.id)]),
        ),
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(bottles)
        .where(and(...resultWhere)),
      db
        .select({
          value: bottles.category,
          count: sql<string>`COUNT(*)`,
        })
        .from(bottles)
        .where(and(...where, ageBandWhere, isNotNull(bottles.category)))
        .groupBy(bottles.category),
      db
        .select({
          nas: sql<string>`COUNT(*) FILTER (WHERE ${bottles.noAgeStatement} IS TRUE)`,
          under_12: sql<string>`COUNT(*) FILTER (WHERE ${bottles.statedAge} < 12)`,
          "12_17": sql<string>`COUNT(*) FILTER (WHERE ${bottles.statedAge} >= 12 AND ${bottles.statedAge} < 18)`,
          "18_24": sql<string>`COUNT(*) FILTER (WHERE ${bottles.statedAge} >= 18 AND ${bottles.statedAge} < 25)`,
          "25_plus": sql<string>`COUNT(*) FILTER (WHERE ${bottles.statedAge} >= 25)`,
        })
        .from(bottles)
        .where(and(...where, categoryWhere)),
    ]);

  const categoryCounts = new Map(
    categoryRows.map(({ value, count }) => [value, Number(count)]),
  );

  return {
    results: await serialize(
      BottleSerializer,
      results.slice(0, limit),
      context.user,
      ["description", "tastingNotes"],
      { includeGroupSummary: true },
    ),
    total: Number(totalRow?.count ?? 0),
    facets: {
      category: CATEGORY_LIST.flatMap((value) => {
        const count = categoryCounts.get(value) ?? 0;
        return count > 0 ? [{ value, count }] : [];
      }),
      ageBand: BOTTLE_AGE_BAND_LIST.flatMap((value) => {
        const count = Number(ageBandCounts?.[value] ?? 0);
        return count > 0 ? [{ value, count }] : [];
      }),
    },
    followedDistillerCount: followedDistillerIds?.length ?? null,
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: !hasUnknownFlight && cursor > 1 ? cursor - 1 : null,
    },
  };
});
