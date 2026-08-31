import config from "@peated/server/config";
import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleGroups,
  bottleReferences,
  bottles,
  bottleSeries,
  bottleTombstones,
  countries,
  entities,
  entityFollows,
  entityReferences,
  entityTombstones,
  follows,
  regions,
  tastings,
  users,
} from "@peated/server/db/schema";
import { parsePeatedId } from "@peated/server/lib/peatedId";
import {
  plainTextSearchQuery,
  prefixTextSearchQuery,
} from "@peated/server/lib/search";
import { absoluteUrl } from "@peated/server/lib/urls";
import { implement } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import searchContract, {
  ENTITY_KIND_BY_SEARCH_SCOPE,
  ENTITY_SEARCH_SCOPE_LIST,
  SEARCH_SCOPE_LIST,
  SearchOutputSchema,
  type EntitySearchScope,
  type SearchScope,
} from "@peated/server/orpc/contracts/search";
import * as Sentry from "@sentry/node";
import { and, asc, eq, isNotNull, like, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

type SearchOutput = z.infer<typeof SearchOutputSchema>;
type OutputGroup = SearchOutput["groups"][number];
type BottleResult = Extract<
  OutputGroup,
  { type: "bottles" }
>["results"][number];
type EntityResult = Extract<OutputGroup, { type: "brands" }>["results"][number];
type RegionResult = Extract<
  OutputGroup,
  { type: "regions" }
>["results"][number];
type MemberResult = Extract<
  OutputGroup,
  { type: "members" }
>["results"][number];

type BottleRow = Omit<BottleResult, "group"> & {
  fullName: string;
  group: { name: string } | null;
};
type EntityRow = EntityResult & {
  shortName: string | null;
  totalTastings: number;
};
type RegionRow = RegionResult & { totalBottles: number };
type ScopeTotals = SearchOutput["scopeTotals"];
type GroupRows =
  | { type: "bottles"; total: number; results: BottleRow[] }
  | { type: EntitySearchScope; total: number; results: EntityRow[] }
  | { type: "regions"; total: number; results: RegionRow[] }
  | { type: "members"; total: number; results: MemberResult[] };

type ExactRow =
  | { type: "bottle"; ref: BottleRow }
  | { type: "entity"; ref: EntityRow }
  | null;

type NearestRow =
  | { type: "bottles"; result: BottleRow; distance: number; tie: number }
  | {
      type: EntitySearchScope;
      result: EntityRow;
      distance: number;
      tie: number;
    }
  | { type: "regions"; result: RegionRow; distance: number; tie: number }
  | { type: "members"; result: MemberResult; distance: number; tie: number };

type SearchRows = {
  query: string;
  exact: ExactRow;
  groups: GroupRows[];
  scopeTotals: ScopeTotals;
  nearest: NearestRow[];
};

type SearchInput = { query: string; scopes: SearchScope[]; limit: number };

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function nameRank(
  names: SQL<unknown>[],
  query: string,
  exactReferenceMatch?: SQL<unknown>,
) {
  // Use exact name, name prefix, word prefix, then other matches.
  // Bottle and Entity queries use activity and ID to break ties.
  const normalizedQuery = normalizeText(query);
  const prefix = `${escapeLike(normalizedQuery)}%`;
  const wordPrefix = `% ${escapeLike(normalizedQuery)}%`;
  const normalizedNames = names.map(
    (name) => sql`LOWER(unaccent(COALESCE(${name}, '')))`,
  );
  const wordNames = normalizedNames.map(
    (name) => sql`REGEXP_REPLACE(${name}, '[^[:alnum:]]+', ' ', 'g')`,
  );

  return sql<number>`CASE
    WHEN ${or(
      ...normalizedNames.map((name) => eq(name, normalizedQuery)),
      exactReferenceMatch,
    )} THEN 0
    WHEN ${or(...normalizedNames.map((name) => like(name, prefix)))} THEN 1
    WHEN ${or(...wordNames.map((name) => like(name, wordPrefix)))} THEN 2
    ELSE 3
  END`;
}

function activeBottleWhere() {
  // Search results and scope totals must use the same active Bottles.
  return and(
    isNotNull(bottles.groupId),
    sql`NOT EXISTS(
      SELECT FROM ${bottleTombstones}
      WHERE ${bottleTombstones.bottleId} = ${bottles.id}
    )`,
  );
}

function visibleMemberWhere(context: Context) {
  // Search results and scope totals must use the same visible members.
  return and(
    eq(users.active, true),
    or(
      eq(users.private, false),
      ...(context.user
        ? [
            eq(users.id, context.user.id),
            sql`${users.id} IN (
              SELECT ${follows.toUserId}
              FROM ${follows}
              WHERE ${follows.fromUserId} = ${context.user.id}
                AND ${follows.status} = 'following'
            )`,
          ]
        : []),
    ),
  );
}

function exactBottleReferenceMatch(query: string) {
  return sql`${bottles.id} IN (
    SELECT ${bottleReferences.bottleId}
    FROM ${bottleReferences}
    WHERE LOWER(${bottleReferences.name}) = ${query.toLowerCase().trim()}
      AND ${bottleReferences.ignored} IS NOT TRUE
      AND ${bottleReferences.bottleId} IS NOT NULL
  )`;
}

function exactEntityReferenceMatch(query: string) {
  return sql`${entities.id} IN (
    SELECT ${entityReferences.entityId}
    FROM ${entityReferences}
    WHERE LOWER(${entityReferences.name}) = ${query.toLowerCase().trim()}
      AND ${entityReferences.entityId} IS NOT NULL
  )`;
}

function bottleRatingCount() {
  return sql<number>`(
    ${bottles.memberScoreCount}
    + ${bottles.externalScoreCount}
    + COALESCE((${bottles.tastingBandCounts}->>'mediocre')::integer, 0)
    + COALESCE((${bottles.tastingBandCounts}->>'good')::integer, 0)
    + COALESCE((${bottles.tastingBandCounts}->>'very_good')::integer, 0)
    + COALESCE((${bottles.tastingBandCounts}->>'outstanding')::integer, 0)
    + COALESCE((${bottles.tastingBandCounts}->>'unicorn')::integer, 0)
  )`;
}

function bottleColumns() {
  return {
    id: bottles.id,
    fullName: bottles.fullName,
    name: bottles.name,
    category: bottles.category,
    edition: bottles.edition,
    statedAge: bottles.statedAge,
    noAgeStatement: bottles.noAgeStatement,
    caskStrength: bottles.caskStrength,
    singleCask: bottles.singleCask,
    abv: bottles.abv,
    vintageYear: bottles.vintageYear,
    releaseYear: bottles.releaseYear,
    imageUrl: bottles.imageUrl,
    medianScore: bottles.medianScore,
    scoreCount:
      sql<number>`${bottles.memberScoreCount} + ${bottles.externalScoreCount}`.mapWith(
        Number,
      ),
    tastingBandCounts: bottles.tastingBandCounts,
    brand: {
      name: entities.name,
      shortName: entities.shortName,
    },
    series: { name: bottleSeries.name },
    group: { name: bottleGroups.name },
  };
}

function entityColumns(context: Context) {
  return {
    id: entities.id,
    name: entities.name,
    shortName: entities.shortName,
    kind: entities.kind,
    region: { name: regions.name },
    totalTastings: entities.totalTastings,
    isFollowing: context.user
      ? sql<boolean>`EXISTS(
          SELECT FROM ${entityFollows}
          WHERE ${entityFollows.userId} = ${context.user.id}
            AND ${entityFollows.entityId} = ${entities.id}
        )`
      : sql<boolean>`FALSE`,
  };
}

function regionColumns() {
  return {
    id: regions.id,
    name: regions.name,
    slug: regions.slug,
    totalBottles: regions.totalBottles,
    totalDistillers: regions.totalDistillers,
    country: {
      name: countries.name,
      slug: countries.slug,
    },
  };
}

function entityScopeWhere(scope: EntitySearchScope) {
  return eq(entities.kind, ENTITY_KIND_BY_SEARCH_SCOPE[scope]);
}

async function countRows(
  database: AnyDatabase,
  table: typeof bottles | typeof entities | typeof regions | typeof users,
  where: SQL<unknown> | undefined,
) {
  const query = database.select({ total: sql<string>`COUNT(*)` });
  let row: { total: string } | undefined;
  if (table === bottles) {
    [row] = await query.from(bottles).where(where);
  } else if (table === entities) {
    [row] = await query.from(entities).where(where);
  } else if (table === regions) {
    [row] = await query.from(regions).where(where);
  } else {
    [row] = await query.from(users).where(where);
  }
  return Number(row?.total ?? 0);
}

async function searchBottles(
  database: AnyDatabase,
  query: string,
  limit: number,
): Promise<{ total: number; results: BottleRow[] }> {
  if (!query) return { total: 0, results: [] };
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  const referenceMatch = exactBottleReferenceMatch(query);
  const where = and(
    activeBottleWhere(),
    or(
      sql`${bottles.searchVector} @@ ${textQuery}`,
      sql`${bottles.searchVector} @@ ${prefixQuery}`,
      referenceMatch,
    ),
  );
  const rank = nameRank(
    [sql`${bottles.fullName}`, sql`${bottles.name}`],
    query,
    referenceMatch,
  );
  const rows = await database
    .select({
      ...bottleColumns(),
      searchTotal: sql<number>`COUNT(*) OVER()`,
    })
    .from(bottles)
    .innerJoin(entities, eq(bottles.brandId, entities.id))
    .leftJoin(bottleSeries, eq(bottles.seriesId, bottleSeries.id))
    .leftJoin(bottleGroups, eq(bottles.groupId, bottleGroups.id))
    .where(where)
    .limit(limit)
    .orderBy(rank, sql`${bottleRatingCount()} DESC`, asc(bottles.id));
  return {
    total: Number(rows[0]?.searchTotal ?? 0),
    results: rows.map(({ searchTotal: _, ...result }) => result),
  };
}

async function searchEntities(
  database: AnyDatabase,
  context: Context,
  scope: EntitySearchScope,
  query: string,
  limit: number,
): Promise<{ total: number; results: EntityRow[] }> {
  if (!query) return { total: 0, results: [] };
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  const referenceMatch = exactEntityReferenceMatch(query);
  const where = and(
    entityScopeWhere(scope),
    or(
      sql`${entities.searchVector} @@ ${textQuery}`,
      sql`${entities.searchVector} @@ ${prefixQuery}`,
      referenceMatch,
    ),
  );
  const rank = nameRank(
    [sql`${entities.name}`, sql`${entities.shortName}`],
    query,
    referenceMatch,
  );
  const rows = await database
    .select({
      ...entityColumns(context),
      searchTotal: sql<number>`COUNT(*) OVER()`,
    })
    .from(entities)
    .leftJoin(regions, eq(entities.regionId, regions.id))
    .where(where)
    .limit(limit)
    .orderBy(rank, sql`${entities.totalTastings} DESC`, asc(entities.id));
  return {
    total: Number(rows[0]?.searchTotal ?? 0),
    results: rows.map(({ searchTotal: _, ...result }) => result),
  };
}

async function searchRegions(
  database: AnyDatabase,
  query: string,
  limit: number,
): Promise<{ total: number; results: RegionRow[] }> {
  if (!query) return { total: 0, results: [] };
  const normalizedQuery = normalizeText(query);
  const name = sql`LOWER(unaccent(${regions.name}))`;
  const where = like(name, `%${escapeLike(normalizedQuery)}%`);
  const rank = nameRank([sql`${regions.name}`], query);
  const rows = await database
    .select({
      ...regionColumns(),
      searchTotal: sql<number>`COUNT(*) OVER()`,
    })
    .from(regions)
    .innerJoin(countries, eq(regions.countryId, countries.id))
    .where(where)
    .limit(limit)
    .orderBy(rank, sql`${regions.totalBottles} DESC`, asc(regions.id));
  return {
    total: Number(rows[0]?.searchTotal ?? 0),
    results: rows.map(({ searchTotal: _, ...result }) => result),
  };
}

async function searchMembers(
  database: AnyDatabase,
  context: Context,
  query: string,
  limit: number,
): Promise<{ total: number; results: MemberResult[] }> {
  if (!context.user || !query) {
    return { total: 0, results: [] };
  }
  const normalizedQuery = normalizeText(query.replace(/^@/, ""));
  const username = sql`LOWER(unaccent(${users.username}))`;
  const where = and(
    visibleMemberWhere(context),
    like(username, `%${escapeLike(normalizedQuery)}%`),
  );
  const rank = nameRank([sql`${users.username}`], normalizedQuery);
  const publicTastingCount = sql<number>`COUNT(${tastings.id}) FILTER (
    WHERE ${users.private} = FALSE
  )`;
  const rows = await database
    .select({
      member: {
        id: users.id,
        username: users.username,
        pictureUrl: users.pictureUrl,
      },
      totalTastings: publicTastingCount,
      searchTotal: sql<number>`COUNT(*) OVER()`,
    })
    .from(users)
    .leftJoin(tastings, eq(tastings.createdById, users.id))
    .where(where)
    .groupBy(users.id)
    .limit(limit)
    .orderBy(rank, sql`${publicTastingCount} DESC`, asc(users.id));
  return {
    total: Number(rows[0]?.searchTotal ?? 0),
    results: rows.map((row) => ({
      member: row.member,
      totalTastings: Number(row.totalTastings),
    })),
  };
}

async function getScopeTotals(
  database: AnyDatabase,
  context: Context,
): Promise<ScopeTotals> {
  const totals: ScopeTotals = {
    bottles: await countRows(database, bottles, activeBottleWhere()),
    distilleries: await countRows(
      database,
      entities,
      entityScopeWhere("distilleries"),
    ),
    brands: await countRows(database, entities, entityScopeWhere("brands")),
    bottlers: await countRows(database, entities, entityScopeWhere("bottlers")),
    companies: await countRows(
      database,
      entities,
      entityScopeWhere("companies"),
    ),
    regions: await countRows(database, regions, undefined),
  };
  if (context.user) {
    totals.members = await countRows(
      database,
      users,
      visibleMemberWhere(context),
    );
  }
  return totals;
}

function entityMatchesScopes(entity: EntityRow, scopes: SearchScope[]) {
  return ENTITY_SEARCH_SCOPE_LIST.some(
    (scope) => scopes.includes(scope) && entityMatchesScope(entity, scope),
  );
}

function entityMatchesScope(entity: EntityRow, scope: EntitySearchScope) {
  return entity.kind === ENTITY_KIND_BY_SEARCH_SCOPE[scope];
}

async function findExact(
  database: AnyDatabase,
  context: Context,
  query: string,
  scopes: SearchScope[],
): Promise<ExactRow> {
  const peatedId = parsePeatedId(query);
  if (!peatedId) return null;

  if (peatedId.type === "bottle" && scopes.includes("bottles")) {
    let [bottle] = await database
      .select(bottleColumns())
      .from(bottles)
      .innerJoin(entities, eq(bottles.brandId, entities.id))
      .leftJoin(bottleSeries, eq(bottles.seriesId, bottleSeries.id))
      .leftJoin(bottleGroups, eq(bottles.groupId, bottleGroups.id))
      .where(eq(bottles.id, peatedId.id));
    if (!bottle) {
      [bottle] = await database
        .select(bottleColumns())
        .from(bottleTombstones)
        .innerJoin(bottles, eq(bottleTombstones.newBottleId, bottles.id))
        .innerJoin(entities, eq(bottles.brandId, entities.id))
        .leftJoin(bottleSeries, eq(bottles.seriesId, bottleSeries.id))
        .leftJoin(bottleGroups, eq(bottles.groupId, bottleGroups.id))
        .where(eq(bottleTombstones.bottleId, peatedId.id));
    }
    return bottle ? { type: "bottle", ref: bottle } : null;
  }

  if (peatedId.type === "entity") {
    let [entity] = await database
      .select(entityColumns(context))
      .from(entities)
      .leftJoin(regions, eq(entities.regionId, regions.id))
      .where(eq(entities.id, peatedId.id));
    if (!entity) {
      [entity] = await database
        .select(entityColumns(context))
        .from(entityTombstones)
        .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
        .leftJoin(regions, eq(entities.regionId, regions.id))
        .where(eq(entityTombstones.entityId, peatedId.id));
    }
    return entity && entityMatchesScopes(entity, scopes)
      ? { type: "entity", ref: entity }
      : null;
  }

  return null;
}

async function searchGroup(
  database: AnyDatabase,
  context: Context,
  scope: SearchScope,
  query: string,
  limit: number,
): Promise<GroupRows> {
  switch (scope) {
    case "bottles":
      return { type: scope, ...(await searchBottles(database, query, limit)) };
    case "distilleries":
    case "brands":
    case "bottlers":
    case "companies":
      return {
        type: scope,
        ...(await searchEntities(database, context, scope, query, limit)),
      };
    case "regions":
      return { type: scope, ...(await searchRegions(database, query, limit)) };
    case "members":
      return {
        type: scope,
        ...(await searchMembers(database, context, query, limit)),
      };
  }
}

function traceSearchGroup(
  database: AnyDatabase,
  context: Context,
  scope: SearchScope,
  query: string,
  limit: number,
  fallback: boolean,
) {
  return Sentry.startSpan(
    {
      name: "search.group",
      op: "function",
      attributes: {
        "search.scope": scope,
        "search.fallback": fallback,
      },
    },
    () => searchGroup(database, context, scope, query, limit),
  );
}

function levenshtein(left: string, right: string) {
  const previous = [...Array(right.length + 1).keys()];
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}

function nearestDistance(query: string, names: (string | null)[]) {
  return Math.min(
    ...names
      .filter((name): name is string => !!name)
      .map((name) => levenshtein(query, normalizeText(name))),
  );
}

async function findNearest(
  database: AnyDatabase,
  context: Context,
  scopes: SearchScope[],
  query: string,
) {
  const normalizedQuery = normalizeText(query.replace(/^@/, ""));
  if (!normalizedQuery) return [];
  const prefix = normalizedQuery.slice(0, Math.min(3, normalizedQuery.length));
  const groups: GroupRows[] = [];
  for (const scope of scopes) {
    groups.push(
      await traceSearchGroup(database, context, scope, prefix, 10, true),
    );
  }

  const nearest: NearestRow[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    switch (group.type) {
      case "bottles":
        for (const result of group.results) {
          const key = `bottles:${result.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          nearest.push({
            type: "bottles",
            result,
            distance: nearestDistance(normalizedQuery, [
              result.fullName,
              result.name,
            ]),
            tie:
              result.scoreCount +
              Object.values(result.tastingBandCounts).reduce(
                (total, count) => total + count,
                0,
              ),
          });
        }
        break;
      case "distilleries":
      case "brands":
      case "bottlers":
      case "companies":
        for (const result of group.results) {
          const key = `entities:${result.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          nearest.push({
            type: group.type,
            result,
            distance: nearestDistance(normalizedQuery, [
              result.name,
              result.shortName,
            ]),
            tie: result.totalTastings,
          });
        }
        break;
      case "regions":
        for (const result of group.results) {
          const key = `regions:${result.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          nearest.push({
            type: "regions",
            result,
            distance: nearestDistance(normalizedQuery, [result.name]),
            tie: result.totalBottles,
          });
        }
        break;
      case "members":
        for (const result of group.results) {
          const key = `members:${result.member.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          nearest.push({
            type: "members",
            result,
            distance: nearestDistance(normalizedQuery, [
              result.member.username,
            ]),
            tie: result.totalTastings,
          });
        }
        break;
    }
  }
  return nearest
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.tie - left.tie ||
        SEARCH_SCOPE_LIST.indexOf(left.type) -
          SEARCH_SCOPE_LIST.indexOf(right.type),
    )
    .slice(0, 3);
}

async function readSearchRows(
  input: SearchInput,
  context: Context,
): Promise<SearchRows> {
  const scopes = SEARCH_SCOPE_LIST.filter(
    (scope) =>
      input.scopes.includes(scope) && (scope !== "members" || !!context.user),
  );
  return db.transaction(
    async (tx) => {
      const scopeTotals = await Sentry.startSpan(
        {
          name: "search.scope_totals",
          op: "function",
          attributes: { "search.authenticated": !!context.user },
        },
        () => getScopeTotals(tx, context),
      );
      const exact = await Sentry.startSpan(
        { name: "search.resolve_exact", op: "function" },
        () => findExact(tx, context, input.query, scopes),
      );
      if (parsePeatedId(input.query)) {
        return {
          query: input.query,
          exact,
          groups: [],
          scopeTotals,
          nearest: [],
        };
      }

      const groups: GroupRows[] = [];
      for (const scope of scopes) {
        groups.push(
          await traceSearchGroup(
            tx,
            context,
            scope,
            input.query,
            input.limit,
            false,
          ),
        );
      }
      const matchTotal = groups.reduce(
        (total, group) => total + group.total,
        0,
      );
      const nearest =
        input.query && matchTotal === 0
          ? await Sentry.startSpan(
              { name: "search.nearest", op: "function" },
              () => findNearest(tx, context, scopes, input.query),
            )
          : [];
      return {
        query: input.query,
        exact: null,
        groups,
        scopeTotals,
        nearest,
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
}

function bottleResult(row: BottleRow, includeGroup = false): BottleResult {
  const { fullName: _, group, ...result } = row;
  const bottle: BottleResult = {
    ...result,
    imageUrl: result.imageUrl
      ? absoluteUrl(config.API_SERVER, result.imageUrl)
      : null,
  };
  if (includeGroup && group) bottle.group = group;
  return bottle;
}

function memberResult(row: MemberResult): MemberResult {
  return {
    ...row,
    member: {
      ...row.member,
      pictureUrl: row.member.pictureUrl
        ? absoluteUrl(config.API_SERVER, row.member.pictureUrl)
        : null,
    },
  };
}

function serializeGroup(group: GroupRows) {
  switch (group.type) {
    case "bottles":
      return {
        ...group,
        results: group.results.map((row) => bottleResult(row, true)),
      };
    case "distilleries":
    case "brands":
    case "bottlers":
    case "companies":
    case "regions":
      return group;
    case "members":
      return {
        ...group,
        results: group.results.map(memberResult),
      };
  }
}

function serializeNearest(row: NearestRow) {
  switch (row.type) {
    case "bottles":
      return {
        type: row.type,
        result: bottleResult(row.result),
      };
    case "distilleries":
    case "brands":
    case "bottlers":
    case "companies":
    case "regions":
      return {
        type: row.type,
        result: row.result,
      };
    case "members":
      return {
        type: row.type,
        result: memberResult(row.result),
      };
  }
}

function serializeSearch(rows: SearchRows) {
  const groups = rows.groups.map(serializeGroup);
  const exact =
    rows.exact?.type === "bottle"
      ? { type: "bottle", ref: bottleResult(rows.exact.ref) }
      : rows.exact;
  const nearest = rows.nearest.map(serializeNearest);
  return SearchOutputSchema.parse({
    query: rows.query,
    exact,
    groups,
    scopeTotals: rows.scopeTotals,
    nearest,
  });
}

async function buildSearchResponse(input: SearchInput, context: Context) {
  const rows = await Sentry.startSpan(
    { name: "search.read", op: "function" },
    () => readSearchRows(input, context),
  );
  return Sentry.startSpan({ name: "search.serialize", op: "function" }, () =>
    serializeSearch(rows),
  );
}

function searchQueryClass(query: string) {
  const normalized = query.trim();
  if (!normalized) return "empty";
  if (parsePeatedId(normalized)) return "peated_id";
  if (normalized.startsWith("@")) return "member_handle";
  return normalized.split(/\s+/).length > 1 ? "multi_token" : "single_token";
}

async function executeSearch(input: SearchInput, context: Context) {
  const normalized = input.query.trim();
  return Sentry.startSpan(
    {
      name: "search.execute",
      op: "function",
      attributes: {
        "search.query.class": searchQueryClass(input.query),
        "search.query.length": normalized.length,
        "search.query.token_count": normalized
          ? normalized.split(/\s+/).length
          : 0,
        "search.scope_count": input.scopes.length,
        "search.limit": input.limit,
        "search.authenticated": !!context.user,
      },
    },
    async (span) => {
      const response = await buildSearchResponse(input, context);
      const resultCount = response.groups.reduce(
        (total, group) => total + group.results.length,
        0,
      );
      span.setAttributes({
        "search.outcome": response.exact
          ? "exact"
          : resultCount
            ? "results"
            : response.nearest.length
              ? "nearest"
              : "empty",
        "search.group_count": response.groups.length,
        "search.result_count": resultCount,
        "search.nearest_count": response.nearest.length,
      });
      return response;
    },
  );
}

// Recent lookups stay in browser storage. This API does not store history.
export default implement(searchContract).handler(({ input, context }) =>
  executeSearch(input, context),
);
