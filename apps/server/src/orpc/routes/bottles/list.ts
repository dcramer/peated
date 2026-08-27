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

export default implement(bottleListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const { query, cursor, limit, filter, ...rest } = input;
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
            sql`'distiller' = ANY(${entities.type})`,
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
  if (rest.category) {
    where.push(eq(bottles.category, rest.category));
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
  if (rest.minRating !== null && rest.minRating !== undefined) {
    // Filter by minimum average rating
    // This ensures bottles have at least some ratings and meet the minimum threshold
    where.push(
      and(
        sql`${bottles.avgRating} IS NOT NULL`,
        sql`${bottles.avgRating} >= ${rest.minRating}`,
      ),
    );
  }
  if (rest.minScore !== null && rest.minScore !== undefined) {
    where.push(
      and(
        sql`${bottles.avgScore} IS NOT NULL`,
        sql`${bottles.avgScore} >= ${rest.minScore}`,
      ),
    );
  }

  if (rest.flight) {
    const [flight] = await db
      .select({ id: flights.id })
      .from(flights)
      .where(eq(flights.publicId, rest.flight));
    if (!flight) {
      return {
        results: [],
        followedDistillerCount: followedDistillerIds?.length ?? null,
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
      };
    }
    where.push(
      sql`EXISTS(SELECT FROM ${flightBottles} WHERE ${flightBottles.flightId} = ${flight.id} AND ${flightBottles.bottleId} = ${bottles.id})`,
    );
  }

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
    case "rating":
      orderBy = sql`${bottles.avgRating} ASC NULLS LAST`;
      break;
    case "-rating":
      orderBy = sql`${bottles.avgRating} DESC NULLS LAST`;
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
      orderBy = sql`${bottles.avgScore} ASC NULLS LAST`;
      break;
    case "-score":
      orderBy = sql`${bottles.avgScore} DESC NULLS LAST`;
      break;
    case "-tastings":
    default:
      orderBy = desc(bottles.totalTastings);
  }

  const results = await db
    .select({ ...getTableColumns(bottles) })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(where ? and(...where) : undefined)
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
    );

  return {
    results: await serialize(
      BottleSerializer,
      results.slice(0, limit),
      context.user,
      ["description", "tastingNotes"],
      { includeGroupSummary: true },
    ),
    followedDistillerCount: followedDistillerIds?.length ?? null,
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
