import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottleTombstones,
  entities,
  entityAliases,
  entityTombstones,
  follows,
  regions,
  tastings,
  users,
  type Bottle,
  type Entity,
  type Region,
  type User,
} from "@peated/server/db/schema";
import { parsePeatedId } from "@peated/server/lib/peatedId";
import {
  plainTextSearchQuery,
  prefixTextSearchQuery,
} from "@peated/server/lib/search";
import { implement } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import searchContract, {
  SEARCH_SCOPE_LIST,
  SearchOutputSchema,
  type ExactSchema,
  type ScopeTotalsSchema,
  type SearchScope,
} from "@peated/server/orpc/contracts/search";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { RegionSerializer } from "@peated/server/serializers/region";
import { UserSerializer } from "@peated/server/serializers/user";
import {
  and,
  asc,
  eq,
  getTableColumns,
  isNotNull,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { z } from "zod";

type EntityScope =
  | "distillers"
  | "brands"
  | "bottlers"
  | "blenders"
  | "companies";
const ENTITY_SCOPE_LIST = [
  "distillers",
  "brands",
  "bottlers",
  "blenders",
  "companies",
] as const;

const ENTITY_TYPE_BY_SCOPE = {
  distillers: "distiller",
  brands: "brand",
  bottlers: "bottler",
} as const;

type MemberRow = { member: User; totalTastings: number };
type ScopeTotals = z.infer<typeof ScopeTotalsSchema>;
type GroupRows =
  | { type: "bottles"; total: number; results: Bottle[] }
  | { type: EntityScope; total: number; results: Entity[] }
  | { type: "regions"; total: number; results: Region[] }
  | { type: "members"; total: number; results: MemberRow[] };

type ExactRow =
  | { type: "bottle"; ref: Bottle }
  | { type: "entity"; ref: Entity }
  | null;

type NearestRow =
  | { type: "bottles"; result: Bottle; distance: number; tie: number }
  | { type: EntityScope; result: Entity; distance: number; tie: number }
  | { type: "regions"; result: Region; distance: number; tie: number }
  | { type: "members"; result: MemberRow; distance: number; tie: number };

type SearchRows = {
  query: string;
  exact: ExactRow;
  groups: GroupRows[];
  scopeTotals: ScopeTotals;
  nearest: NearestRow[];
};

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
  aliasChecks: {
    exact: SQL<unknown>;
    prefix: SQL<unknown>;
    word: SQL<unknown>;
  } | null,
) {
  // Use exact name, name prefix, word prefix, then other matches.
  // Bottle and Entity queries use rating count and ID to break ties.
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
      aliasChecks?.exact,
    )} THEN 0
    WHEN ${or(
      ...normalizedNames.map((name) => like(name, prefix)),
      aliasChecks?.prefix,
    )} THEN 1
    WHEN ${or(
      ...wordNames.map((name) => like(name, wordPrefix)),
      aliasChecks?.word,
    )} THEN 2
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

function bottleAliasRank(query: string) {
  const normalizedQuery = normalizeText(query);
  const prefix = `${escapeLike(normalizedQuery)}%`;
  const wordPrefix = `% ${escapeLike(normalizedQuery)}%`;
  const aliasName = sql`LOWER(unaccent(${bottleAliases.name}))`;
  const wordName = sql`REGEXP_REPLACE(${aliasName}, '[^[:alnum:]]+', ' ', 'g')`;
  const exists = (condition: SQL<unknown>) => sql`EXISTS(
    SELECT FROM ${bottleAliases}
    WHERE ${bottleAliases.bottleId} = ${bottles.id} AND ${condition}
  )`;

  return {
    exact: exists(eq(aliasName, normalizedQuery)),
    prefix: exists(like(aliasName, prefix)),
    word: exists(like(wordName, wordPrefix)),
  };
}

function bottleAliasMatches(query: string) {
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  return sql`EXISTS(
    SELECT FROM ${bottleAliases}
    WHERE ${bottleAliases.bottleId} = ${bottles.id}
      AND (
        to_tsvector('english', unaccent(${bottleAliases.name})) @@ ${textQuery}
        OR to_tsvector('english', unaccent(${bottleAliases.name})) @@ ${prefixQuery}
      )
  )`;
}

function entityAliasRank(query: string) {
  const normalizedQuery = normalizeText(query);
  const prefix = `${escapeLike(normalizedQuery)}%`;
  const wordPrefix = `% ${escapeLike(normalizedQuery)}%`;
  const aliasName = sql`LOWER(unaccent(${entityAliases.name}))`;
  const wordName = sql`REGEXP_REPLACE(${aliasName}, '[^[:alnum:]]+', ' ', 'g')`;
  const exists = (condition: SQL<unknown>) => sql`EXISTS(
    SELECT FROM ${entityAliases}
    WHERE ${entityAliases.entityId} = ${entities.id} AND ${condition}
  )`;

  return {
    exact: exists(eq(aliasName, normalizedQuery)),
    prefix: exists(like(aliasName, prefix)),
    word: exists(like(wordName, wordPrefix)),
  };
}

function entityAliasMatches(query: string) {
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  return sql`EXISTS(
    SELECT FROM ${entityAliases}
    WHERE ${entityAliases.entityId} = ${entities.id}
      AND (
        to_tsvector('english', unaccent(${entityAliases.name})) @@ ${textQuery}
        OR to_tsvector('english', unaccent(${entityAliases.name})) @@ ${prefixQuery}
      )
  )`;
}

function bottleRatingCount() {
  return sql<number>`(
    COALESCE((${bottles.ratingStats}->>'total')::integer, 0)
    + ${bottles.totalScores}
  )`;
}

function entityRatingCount() {
  return sql<number>`(
    SELECT COUNT(${tastings.id})
    FROM ${tastings}
    INNER JOIN ${bottles} AS rating_bottle
      ON rating_bottle.id = ${tastings.bottleId}
    WHERE (${tastings.rating} IS NOT NULL OR ${tastings.score} IS NOT NULL)
      AND (
        rating_bottle.brand_id = ${entities.id}
        OR rating_bottle.bottler_id = ${entities.id}
        OR EXISTS(
          SELECT FROM bottle_distiller
          WHERE bottle_distiller.bottle_id = rating_bottle.id
            AND bottle_distiller.distiller_id = ${entities.id}
        )
      )
  )`;
}

function entityScopeWhere(scope: EntityScope) {
  switch (scope) {
    case "blenders":
      return eq(entities.kind, "blender");
    case "companies":
      return eq(entities.kind, "company");
    case "distillers":
    case "brands":
    case "bottlers":
      return sql`${ENTITY_TYPE_BY_SCOPE[scope]} = ANY(${entities.type})`;
  }
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
): Promise<{ total: number; results: Bottle[] }> {
  if (!query) return { total: 0, results: [] };
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  const where = and(
    activeBottleWhere(),
    or(
      sql`${bottles.searchVector} @@ ${textQuery}`,
      sql`${bottles.searchVector} @@ ${prefixQuery}`,
      bottleAliasMatches(query),
    ),
  );
  const rank = nameRank(
    [sql`${bottles.fullName}`, sql`${bottles.name}`],
    query,
    bottleAliasRank(query),
  );
  const total = await countRows(database, bottles, where);
  const results = await database
    .select()
    .from(bottles)
    .where(where)
    .limit(limit)
    .orderBy(rank, sql`${bottleRatingCount()} DESC`, asc(bottles.id));
  return { total, results };
}

async function searchEntities(
  database: AnyDatabase,
  scope: EntityScope,
  query: string,
  limit: number,
): Promise<{ total: number; results: Entity[] }> {
  if (!query) return { total: 0, results: [] };
  const textQuery = plainTextSearchQuery(query);
  const prefixQuery = prefixTextSearchQuery(query);
  const where = and(
    entityScopeWhere(scope),
    or(
      sql`${entities.searchVector} @@ ${textQuery}`,
      sql`${entities.searchVector} @@ ${prefixQuery}`,
      entityAliasMatches(query),
    ),
  );
  const rank = nameRank(
    [sql`${entities.name}`, sql`${entities.shortName}`],
    query,
    entityAliasRank(query),
  );
  const total = await countRows(database, entities, where);
  const results = await database
    .select()
    .from(entities)
    .where(where)
    .limit(limit)
    .orderBy(rank, sql`${entityRatingCount()} DESC`, asc(entities.id));
  return { total, results };
}

async function searchRegions(
  database: AnyDatabase,
  query: string,
  limit: number,
): Promise<{ total: number; results: Region[] }> {
  if (!query) return { total: 0, results: [] };
  const normalizedQuery = normalizeText(query);
  const name = sql`LOWER(unaccent(${regions.name}))`;
  const where = like(name, `%${escapeLike(normalizedQuery)}%`);
  const rank = nameRank([sql`${regions.name}`], query, null);
  const total = await countRows(database, regions, where);
  const results = await database
    .select()
    .from(regions)
    .where(where)
    .limit(limit)
    .orderBy(rank, sql`${regions.totalBottles} DESC`, asc(regions.id));
  return { total, results };
}

async function searchMembers(
  database: AnyDatabase,
  context: Context,
  query: string,
  limit: number,
): Promise<{ total: number; results: MemberRow[] }> {
  if (!context.user || !query) {
    return { total: 0, results: [] };
  }
  const normalizedQuery = normalizeText(query.replace(/^@/, ""));
  const username = sql`LOWER(unaccent(${users.username}))`;
  const where = and(
    visibleMemberWhere(context),
    like(username, `%${escapeLike(normalizedQuery)}%`),
  );
  const rank = nameRank([sql`${users.username}`], normalizedQuery, null);
  const publicTastingCount = sql<number>`COUNT(${tastings.id}) FILTER (
    WHERE ${users.private} = FALSE
  )`;
  const total = await countRows(database, users, where);
  const rows = await database
    .select({
      member: getTableColumns(users),
      totalTastings: publicTastingCount,
    })
    .from(users)
    .leftJoin(tastings, eq(tastings.createdById, users.id))
    .where(where)
    .groupBy(users.id)
    .limit(limit)
    .orderBy(rank, sql`${publicTastingCount} DESC`, asc(users.id));
  return {
    total,
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
    distillers: await countRows(
      database,
      entities,
      entityScopeWhere("distillers"),
    ),
    brands: await countRows(database, entities, entityScopeWhere("brands")),
    bottlers: await countRows(database, entities, entityScopeWhere("bottlers")),
    blenders: await countRows(database, entities, entityScopeWhere("blenders")),
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

function entityMatchesScopes(entity: Entity, scopes: SearchScope[]) {
  return ENTITY_SCOPE_LIST.some(
    (scope) => scopes.includes(scope) && entityMatchesScope(entity, scope),
  );
}

function entityMatchesScope(entity: Entity, scope: EntityScope) {
  switch (scope) {
    case "blenders":
      return entity.kind === "blender";
    case "companies":
      return entity.kind === "company";
    case "distillers":
    case "brands":
    case "bottlers":
      return entity.type.includes(ENTITY_TYPE_BY_SCOPE[scope]);
  }
}

async function findExact(
  database: AnyDatabase,
  query: string,
  scopes: SearchScope[],
): Promise<ExactRow> {
  const peatedId = parsePeatedId(query);
  if (!peatedId) return null;

  if (peatedId.type === "bottle" && scopes.includes("bottles")) {
    let [bottle] = await database
      .select()
      .from(bottles)
      .where(eq(bottles.id, peatedId.id));
    if (!bottle) {
      [bottle] = await database
        .select({ ...getTableColumns(bottles) })
        .from(bottleTombstones)
        .innerJoin(bottles, eq(bottleTombstones.newBottleId, bottles.id))
        .where(eq(bottleTombstones.bottleId, peatedId.id));
    }
    return bottle ? { type: "bottle", ref: bottle } : null;
  }

  if (peatedId.type === "entity") {
    let [entity] = await database
      .select()
      .from(entities)
      .where(eq(entities.id, peatedId.id));
    if (!entity) {
      [entity] = await database
        .select({ ...getTableColumns(entities) })
        .from(entityTombstones)
        .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
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
    case "distillers":
    case "brands":
    case "bottlers":
    case "blenders":
    case "companies":
      return {
        type: scope,
        ...(await searchEntities(database, scope, query, limit)),
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
    groups.push(await searchGroup(database, context, scope, prefix, 10));
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
            tie: result.ratingStats.total + result.totalScores,
          });
        }
        break;
      case "distillers":
      case "brands":
      case "bottlers":
      case "blenders":
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
  input: { query: string; scopes: SearchScope[]; limit: number },
  context: Context,
): Promise<SearchRows> {
  const scopes = SEARCH_SCOPE_LIST.filter(
    (scope) =>
      input.scopes.includes(scope) && (scope !== "members" || !!context.user),
  );
  return db.transaction(
    async (tx) => {
      const scopeTotals = await getScopeTotals(tx, context);
      const exact = await findExact(tx, input.query, scopes);
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
          await searchGroup(tx, context, scope, input.query, input.limit),
        );
      }
      const matchTotal = groups.reduce(
        (total, group) => total + group.total,
        0,
      );
      const nearest =
        input.query && matchTotal === 0
          ? await findNearest(tx, context, scopes, input.query)
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

async function serializeGroup(group: GroupRows, context: Context) {
  switch (group.type) {
    case "bottles":
      return {
        ...group,
        results: await serialize(
          BottleSerializer,
          group.results,
          context.user,
          ["description", "tastingNotes"],
          { includeGroupSummary: true },
        ),
      };
    case "distillers":
    case "brands":
    case "bottlers":
    case "blenders":
    case "companies":
      return {
        ...group,
        results: await serialize(EntitySerializer, group.results, context.user),
      };
    case "regions":
      return {
        ...group,
        results: await serialize(RegionSerializer, group.results, context.user),
      };
    case "members": {
      const members = await serialize(
        UserSerializer,
        group.results.map((result) => result.member),
        context.user,
      );
      return {
        ...group,
        results: group.results.map((result, index) => ({
          member: members[index]!,
          totalTastings: result.totalTastings,
        })),
      };
    }
  }
}

async function serializeNearest(row: NearestRow, context: Context) {
  switch (row.type) {
    case "bottles":
      return {
        type: row.type,
        result: await serialize(BottleSerializer, row.result, context.user),
      };
    case "distillers":
    case "brands":
    case "bottlers":
    case "blenders":
    case "companies":
      return {
        type: row.type,
        result: await serialize(EntitySerializer, row.result, context.user),
      };
    case "regions":
      return {
        type: row.type,
        result: await serialize(RegionSerializer, row.result, context.user),
      };
    case "members":
      return {
        type: row.type,
        result: {
          member: await serialize(
            UserSerializer,
            row.result.member,
            context.user,
          ),
          totalTastings: row.result.totalTastings,
        },
      };
  }
}

async function buildSearchResponse(
  input: { query: string; scopes: SearchScope[]; limit: number },
  context: Context,
) {
  const rows = await readSearchRows(input, context);
  const groups = [];
  for (const group of rows.groups) {
    groups.push(await serializeGroup(group, context));
  }
  let exact: z.infer<typeof ExactSchema> = null;
  if (rows.exact?.type === "bottle") {
    exact = {
      type: "bottle",
      ref: await serialize(BottleSerializer, rows.exact.ref, context.user),
    };
  } else if (rows.exact?.type === "entity") {
    exact = {
      type: "entity",
      ref: await serialize(EntitySerializer, rows.exact.ref, context.user),
    };
  }
  const nearest = [];
  for (const row of rows.nearest) {
    nearest.push(await serializeNearest(row, context));
  }
  return SearchOutputSchema.parse({
    query: rows.query,
    exact,
    groups,
    scopeTotals: rows.scopeTotals,
    nearest,
  });
}

// Recent lookups stay in browser storage. This API does not store history.
export default implement(searchContract).handler(({ input, context }) =>
  buildSearchResponse(input, context),
);
