import { normalizeString } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { webSearchQuery } from "@peated/server/lib/search";
import { and, eq, ilike, or, sql } from "drizzle-orm";

const CONTAINED_MATCH_FETCH_MULTIPLIER = 4;
export type ClassifierEntitySearchArgs = {
  query: string;
  limit: number;
  kind?: ClassifierEntityResolution["kind"];
};

export type ClassifierEntityResolution = {
  entityId: number;
  name: string;
  shortName: string | null;
  kind: "brand" | "bottler" | "distillery" | "blender" | "company";
  alias: string | null;
  score: number | null;
  source: ("contained" | "exact" | "text" | "prefix")[];
};

function normalizeEntityLookupText(value: string) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizedSql(value: any) {
  return sql`regexp_replace(lower(coalesce(${value}, '')), '[^a-z0-9]+', '', 'g')`;
}

function mergeResult(
  results: Map<number, ClassifierEntityResolution>,
  candidate: ClassifierEntityResolution,
) {
  const existing = results.get(candidate.entityId);
  if (!existing) {
    results.set(candidate.entityId, candidate);
    return;
  }

  existing.source = Array.from(
    new Set([...existing.source, ...candidate.source]),
  );

  if (
    candidate.score !== null &&
    (existing.score === null || candidate.score > existing.score)
  ) {
    existing.score = candidate.score;
  }

  if (!existing.alias && candidate.alias) {
    existing.alias = candidate.alias;
  }
}

export async function searchClassifierEntities(
  args: ClassifierEntitySearchArgs,
): Promise<ClassifierEntityResolution[]> {
  const normalizedQuery = normalizeEntityLookupText(args.query);
  const results = new Map<number, ClassifierEntityResolution>();

  const exactMatches = await db
    .select({
      entityId: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      kind: entities.kind,
      alias: entityAliases.name,
    })
    .from(entities)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
    .where(
      and(
        args.kind ? eq(entities.kind, args.kind) : undefined,
        or(
          eq(sql`LOWER(${entities.name})`, args.query.toLowerCase()),
          eq(
            sql`LOWER(COALESCE(${entities.shortName}, ''))`,
            args.query.toLowerCase(),
          ),
          eq(
            sql`LOWER(COALESCE(${entityAliases.name}, ''))`,
            args.query.toLowerCase(),
          ),
          normalizedQuery
            ? eq(normalizedSql(entities.name), normalizedQuery)
            : undefined,
          normalizedQuery
            ? eq(normalizedSql(entities.shortName), normalizedQuery)
            : undefined,
          normalizedQuery
            ? eq(normalizedSql(entityAliases.name), normalizedQuery)
            : undefined,
        ),
      ),
    )
    .limit(args.limit);

  for (const row of exactMatches) {
    mergeResult(results, {
      entityId: row.entityId,
      name: row.name,
      shortName: row.shortName,
      kind: row.kind!,
      alias: row.alias,
      score: 1,
      source: ["exact"],
    });
  }

  const textQuery = webSearchQuery(args.query);
  const textScore = sql<number>`ts_rank(${entities.searchVector}, ${textQuery})`;
  const textMatches = await db
    .select({
      entityId: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      kind: entities.kind,
      score: textScore,
    })
    .from(entities)
    .where(
      and(
        args.kind ? eq(entities.kind, args.kind) : undefined,
        sql`${entities.searchVector} IS NOT NULL`,
        sql`${entities.searchVector} @@ ${textQuery}`,
      ),
    )
    .orderBy(sql`${textScore} DESC`, entities.name)
    .limit(args.limit);

  for (const row of textMatches) {
    mergeResult(results, {
      entityId: row.entityId,
      name: row.name,
      shortName: row.shortName,
      kind: row.kind!,
      alias: null,
      score: row.score === null ? null : Number(row.score),
      source: ["text"],
    });
  }

  const prefixMatches = await db
    .select({
      entityId: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      kind: entities.kind,
      alias: entityAliases.name,
    })
    .from(entities)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
    .where(
      and(
        args.kind ? eq(entities.kind, args.kind) : undefined,
        or(
          ilike(entities.name, `${args.query}%`),
          sql`COALESCE(${entities.shortName}, '') ILIKE ${`${args.query}%`}`,
          sql`COALESCE(${entityAliases.name}, '') ILIKE ${`${args.query}%`}`,
        ),
      ),
    )
    .limit(args.limit);

  for (const row of prefixMatches) {
    mergeResult(results, {
      entityId: row.entityId,
      name: row.name,
      shortName: row.shortName,
      kind: row.kind!,
      alias: row.alias,
      score: 0.5,
      source: ["prefix"],
    });
  }

  // Containment only widens retrieval; the length floor and low score keep it from implying identity.
  const matchingAlias = sql<string | null>`(
    array_agg(
      ${entityAliases.name}
      ORDER BY length(${normalizedSql(entityAliases.name)}) DESC, ${entityAliases.name}
    ) FILTER (
      WHERE length(${normalizedSql(entityAliases.name)}) >= 4
        AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entityAliases.name)} || '%'
    )
  )[1]`;
  const matchingNameLength = sql<number>`CASE
    WHEN length(${normalizedSql(entities.name)}) >= 4
      AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entities.name)} || '%'
    THEN length(${normalizedSql(entities.name)})
    ELSE 0
  END`;
  const matchingShortNameLength = sql<number>`CASE
    WHEN length(${normalizedSql(entities.shortName)}) >= 4
      AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entities.shortName)} || '%'
    THEN length(${normalizedSql(entities.shortName)})
    ELSE 0
  END`;
  const matchingAliasLength = sql<number>`coalesce(max(CASE
    WHEN length(${normalizedSql(entityAliases.name)}) >= 4
      AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entityAliases.name)} || '%'
    THEN length(${normalizedSql(entityAliases.name)})
    ELSE 0
  END), 0)`;
  const containedSpecificity = sql<number>`GREATEST(
    ${matchingNameLength},
    ${matchingShortNameLength},
    ${matchingAliasLength}
  )`;
  const containedMatches = normalizedQuery
    ? await db
        .select({
          entityId: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          kind: entities.kind,
          alias: matchingAlias,
          specificity: containedSpecificity,
        })
        .from(entities)
        .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
        .where(
          and(
            args.kind ? eq(entities.kind, args.kind) : undefined,
            or(
              sql`length(${normalizedSql(entities.name)}) >= 4 AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entities.name)} || '%'`,
              sql`length(${normalizedSql(entities.shortName)}) >= 4 AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entities.shortName)} || '%'`,
              sql`length(${normalizedSql(entityAliases.name)}) >= 4 AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entityAliases.name)} || '%'`,
            ),
          ),
        )
        .groupBy(entities.id, entities.name, entities.shortName, entities.kind)
        .orderBy(sql`${containedSpecificity} DESC`, entities.name)
        .limit(args.limit * CONTAINED_MATCH_FETCH_MULTIPLIER)
    : [];

  for (const row of containedMatches) {
    const score =
      0.25 + 0.2 * (Number(row.specificity) / normalizedQuery.length);
    mergeResult(results, {
      entityId: row.entityId,
      name: row.name,
      shortName: row.shortName,
      kind: row.kind!,
      alias: row.alias,
      score,
      source: ["contained"],
    });
  }

  return Array.from(results.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, args.limit);
}
