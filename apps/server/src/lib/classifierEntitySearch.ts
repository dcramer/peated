import { normalizeString } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  entities,
  entityReferences,
  type Entity,
} from "@peated/server/db/schema";
import {
  entityTextPredicate,
  textSearchQuery,
} from "@peated/server/lib/textSearch";
import { and, eq, or, sql } from "drizzle-orm";

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

/** SQL LIKE treats these characters as patterns; a query must match them literally. */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// A contained name is at least this long, so short words do not match.
const MIN_CONTAINED_NAME_LENGTH = 4;
// Longer normalized names are not realistic Entity names.
const MAX_CONTAINED_NAME_LENGTH = 100;

/**
 * Every normalized name the query could contain. Looking these up by index
 * finds the same Entities as testing each stored name against the query.
 */
function containedNameCandidates(normalizedQuery: string): string[] {
  const candidates = new Set<string>();
  for (let start = 0; start < normalizedQuery.length; start++) {
    const maxEnd = Math.min(
      normalizedQuery.length,
      start + MAX_CONTAINED_NAME_LENGTH,
    );
    for (let end = start + MIN_CONTAINED_NAME_LENGTH; end <= maxEnd; end++) {
      candidates.add(normalizedQuery.slice(start, end));
    }
  }
  return [...candidates];
}

// Entity lookups query entities and their references separately so each
// comparison can use its index; an OR across the join forces a full scan.
export async function searchClassifierEntities(
  args: ClassifierEntitySearchArgs,
): Promise<ClassifierEntityResolution[]> {
  const normalizedQuery = normalizeEntityLookupText(args.query);
  const lowerQuery = args.query.toLowerCase();
  const prefixPattern = `${escapeLikePattern(lowerQuery)}%`;
  const containedNames = normalizedQuery
    ? containedNameCandidates(normalizedQuery)
    : [];
  // One array parameter; a long query has too many substrings to bind singly.
  const containedNamesParam = sql`${sql.param(containedNames)}::text[]`;
  const containedNameSet = new Set(containedNames);
  const kindFilter = args.kind ? eq(entities.kind, args.kind) : undefined;
  const entityColumns = {
    entityId: entities.id,
    name: entities.name,
    shortName: entities.shortName,
    kind: entities.kind,
  };
  const referenceColumns = {
    ...entityColumns,
    reference: entityReferences.name,
    normalizedReference: entityReferences.normalizedName,
  };
  // Run one lookup at a time: each is an index lookup, and the classifier
  // already runs several Entity searches at once, so parallel lookups here
  // would only compete for database connections.
  const exactEntityMatches = await db
    .select(entityColumns)
    .from(entities)
    .where(
      and(
        kindFilter,
        or(
          eq(sql`LOWER(${entities.name})`, lowerQuery),
          eq(sql`LOWER(${entities.shortName})`, lowerQuery),
          normalizedQuery
            ? eq(entities.normalizedName, normalizedQuery)
            : undefined,
          normalizedQuery
            ? eq(entities.normalizedShortName, normalizedQuery)
            : undefined,
        ),
      ),
    )
    .limit(args.limit);
  const exactReferenceMatches = await db
    .select(referenceColumns)
    .from(entityReferences)
    .innerJoin(entities, eq(entities.id, entityReferences.entityId))
    .where(
      and(
        kindFilter,
        or(
          eq(sql`LOWER(${entityReferences.name})`, lowerQuery),
          normalizedQuery
            ? eq(entityReferences.normalizedName, normalizedQuery)
            : undefined,
        ),
      ),
    )
    .limit(args.limit);
  // Text matches rank below exact, prefix, and contained matches.
  const textMatches = await db
    .select(entityColumns)
    .from(entities)
    .where(and(kindFilter, entityTextPredicate(textSearchQuery(args.query))))
    .orderBy(entities.name)
    .limit(args.limit);
  const prefixEntityMatches = await db
    .select(entityColumns)
    .from(entities)
    .where(
      and(
        kindFilter,
        or(
          sql`LOWER(${entities.name}) LIKE ${prefixPattern}`,
          sql`LOWER(${entities.shortName}) LIKE ${prefixPattern}`,
        ),
      ),
    )
    .limit(args.limit);
  const prefixReferenceMatches = await db
    .select(referenceColumns)
    .from(entityReferences)
    .innerJoin(entities, eq(entities.id, entityReferences.entityId))
    .where(
      and(
        kindFilter,
        sql`LOWER(${entityReferences.name}) LIKE ${prefixPattern}`,
      ),
    )
    .limit(args.limit);
  const containedEntityMatches = containedNames.length
    ? await db
        .select({
          ...entityColumns,
          normalizedName: entities.normalizedName,
          normalizedShortName: entities.normalizedShortName,
        })
        .from(entities)
        .where(
          and(
            kindFilter,
            or(
              sql`${entities.normalizedName} = ANY(${containedNamesParam})`,
              sql`${entities.normalizedShortName} = ANY(${containedNamesParam})`,
            ),
          ),
        )
    : [];
  const containedReferenceMatches = containedNames.length
    ? await db
        .select(referenceColumns)
        .from(entityReferences)
        .innerJoin(entities, eq(entities.id, entityReferences.entityId))
        .where(
          and(
            kindFilter,
            sql`${entityReferences.normalizedName} = ANY(${containedNamesParam})`,
          ),
        )
    : [];

  const results = new Map<number, ClassifierEntityResolution>();
  const add = (
    row: EntityRow,
    reference: string | null,
    score: number,
    source: ClassifierEntityResolution["source"][number],
  ) =>
    mergeResult(results, {
      entityId: row.entityId,
      name: row.name,
      shortName: row.shortName,
      kind: row.kind!,
      reference,
      score,
      source: [source],
    });

  for (const row of exactEntityMatches) add(row, null, 1, "exact");
  for (const row of exactReferenceMatches) {
    add(row, row.reference, 1, "exact");
  }
  for (const row of textMatches) add(row, null, 0.2, "text");
  for (const row of prefixEntityMatches) add(row, null, 0.5, "prefix");
  for (const row of prefixReferenceMatches) {
    add(row, row.reference, 0.5, "prefix");
  }

  // Containment only widens retrieval; the length floor and low score keep it
  // from implying identity. The longest contained name is the most specific,
  // and the longest contained reference is the one reported.
  const contained = new Map<
    number,
    { row: EntityRow; specificity: number; reference: string | null }
  >();
  const containedLength = (value: string | null) =>
    value && containedNameSet.has(value) ? value.length : 0;
  for (const row of containedEntityMatches) {
    contained.set(row.entityId, {
      row,
      specificity: Math.max(
        containedLength(row.normalizedName),
        containedLength(row.normalizedShortName),
      ),
      reference: null,
    });
  }
  const referencesByLength = [...containedReferenceMatches].sort(
    (a, b) =>
      containedLength(b.normalizedReference) -
        containedLength(a.normalizedReference) ||
      a.reference.localeCompare(b.reference),
  );
  for (const row of referencesByLength) {
    const length = containedLength(row.normalizedReference);
    const existing = contained.get(row.entityId);
    if (!existing) {
      contained.set(row.entityId, {
        row,
        specificity: length,
        reference: row.reference,
      });
    } else if (existing.reference === null) {
      existing.reference = row.reference;
      existing.specificity = Math.max(existing.specificity, length);
    }
  }
  const containedMatches = [...contained.values()]
    .sort(
      (a, b) =>
        b.specificity - a.specificity || a.row.name.localeCompare(b.row.name),
    )
    .slice(0, args.limit * CONTAINED_MATCH_FETCH_MULTIPLIER);
  for (const { row, specificity, reference } of containedMatches) {
    add(
      row,
      reference,
      0.25 + 0.2 * (specificity / normalizedQuery.length),
      "contained",
    );
  }

  return Array.from(results.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, args.limit);
}

type EntityRow = {
  entityId: number;
  name: string;
  shortName: string | null;
  kind: Entity["kind"];
};
