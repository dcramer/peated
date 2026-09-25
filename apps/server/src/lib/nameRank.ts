import { eq, like, or, sql, type SQL } from "drizzle-orm";

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function nameRank(
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
