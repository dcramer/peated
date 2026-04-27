import { normalizeString } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";

export type ClassifierEntitySearchArgs = {
  query: string;
  type?: "brand" | "bottler" | "distiller" | null;
  limit: number;
};

export type ClassifierEntityResolution = {
  entityId: number;
  name: string;
  shortName: string | null;
  type: ("brand" | "bottler" | "distiller")[];
  alias: string | null;
  score: number | null;
  source: ("exact" | "text" | "prefix")[];
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
      type: entities.type,
      alias: entityAliases.name,
    })
    .from(entities)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
    .where(
      and(
        args.type ? sql`${args.type} = ANY(${entities.type})` : undefined,
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
      type: row.type as ClassifierEntityResolution["type"],
      alias: row.alias,
      score: 1,
      source: ["exact"],
    });
  }

  const textMatches = await db.execute<{
    entityId: number;
    name: string;
    shortName: string | null;
    type: string[];
    score: number | null;
  }>(sql`
    SELECT
      ${entities.id} AS "entityId",
      ${entities.name} AS "name",
      ${entities.shortName} AS "shortName",
      ${entities.type} AS "type",
      ts_rank(${entities.searchVector}, websearch_to_tsquery('english', ${args.query})) AS score
    FROM ${entities}
    WHERE ${entities.searchVector} IS NOT NULL
      AND ${entities.searchVector} @@ websearch_to_tsquery('english', ${args.query})
      ${args.type ? sql`AND ${args.type} = ANY(${entities.type})` : sql``}
    ORDER BY score DESC, ${entities.name} ASC
    LIMIT ${args.limit}
  `);

  for (const row of textMatches.rows) {
    mergeResult(results, {
      entityId: row.entityId,
      name: row.name,
      shortName: row.shortName,
      type: row.type as ClassifierEntityResolution["type"],
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
      type: entities.type,
      alias: entityAliases.name,
    })
    .from(entities)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
    .where(
      and(
        args.type ? sql`${args.type} = ANY(${entities.type})` : undefined,
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
      type: row.type as ClassifierEntityResolution["type"],
      alias: row.alias,
      score: 0.5,
      source: ["prefix"],
    });
  }

  return Array.from(results.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, args.limit);
}
