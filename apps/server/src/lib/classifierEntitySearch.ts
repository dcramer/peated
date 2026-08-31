import { normalizeString } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { entities, entityReferences } from "@peated/server/db/schema";
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
  kind: "brand" | "bottler" | "distillery" | "company";
  reference: string | null;
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

  if (!existing.reference && candidate.reference) {
    existing.reference = candidate.reference;
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
      reference: entityReferences.name,
    })
    .from(entities)
    .leftJoin(entityReferences, eq(entityReferences.entityId, entities.id))
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
            sql`LOWER(COALESCE(${entityReferences.name}, ''))`,
            args.query.toLowerCase(),
          ),
          normalizedQuery
            ? eq(normalizedSql(entities.name), normalizedQuery)
            : undefined,
          normalizedQuery
            ? eq(normalizedSql(entities.shortName), normalizedQuery)
            : undefined,
          normalizedQuery
            ? eq(normalizedSql(entityReferences.name), normalizedQuery)
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
      reference: row.reference,
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
      reference: null,
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
      reference: entityReferences.name,
    })
    .from(entities)
    .leftJoin(entityReferences, eq(entityReferences.entityId, entities.id))
    .where(
      and(
        args.kind ? eq(entities.kind, args.kind) : undefined,
        or(
          ilike(entities.name, `${args.query}%`),
          sql`COALESCE(${entities.shortName}, '') ILIKE ${`${args.query}%`}`,
          sql`COALESCE(${entityReferences.name}, '') ILIKE ${`${args.query}%`}`,
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
      reference: row.reference,
      score: 0.5,
      source: ["prefix"],
    });
  }

  // Containment only widens retrieval; the length floor and low score keep it from implying identity.
  const matchingReference = sql<string | null>`(
    array_agg(
      ${entityReferences.name}
      ORDER BY length(${normalizedSql(entityReferences.name)}) DESC, ${entityReferences.name}
    ) FILTER (
      WHERE length(${normalizedSql(entityReferences.name)}) >= 4
        AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entityReferences.name)} || '%'
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
  const matchingReferenceLength = sql<number>`coalesce(max(CASE
    WHEN length(${normalizedSql(entityReferences.name)}) >= 4
      AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entityReferences.name)} || '%'
    THEN length(${normalizedSql(entityReferences.name)})
    ELSE 0
  END), 0)`;
  const containedSpecificity = sql<number>`GREATEST(
    ${matchingNameLength},
    ${matchingShortNameLength},
    ${matchingReferenceLength}
  )`;
  const containedMatches = normalizedQuery
    ? await db
        .select({
          entityId: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          kind: entities.kind,
          reference: matchingReference,
          specificity: containedSpecificity,
        })
        .from(entities)
        .leftJoin(entityReferences, eq(entityReferences.entityId, entities.id))
        .where(
          and(
            args.kind ? eq(entities.kind, args.kind) : undefined,
            or(
              sql`length(${normalizedSql(entities.name)}) >= 4 AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entities.name)} || '%'`,
              sql`length(${normalizedSql(entities.shortName)}) >= 4 AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entities.shortName)} || '%'`,
              sql`length(${normalizedSql(entityReferences.name)}) >= 4 AND ${normalizedQuery} LIKE '%' || ${normalizedSql(entityReferences.name)} || '%'`,
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
      reference: row.reference,
      score,
      source: ["contained"],
    });
  }

  return Array.from(results.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, args.limit);
}
