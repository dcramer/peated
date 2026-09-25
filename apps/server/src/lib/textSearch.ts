import { sql } from "drizzle-orm";
import { bottleSeries, bottles, entities } from "../db/schema";

// Broad-query rule (bottle-search.md): words that describe almost every
// whisky add nothing to an OR search, but an OR over them matches most of
// the catalog and TIN must score every match. Drop them when a query keeps
// at least one other word. AND and phrase searches keep every word.
const BROAD_QUERY_STOP_TOKENS = new Set([
  "a",
  "aged",
  "blend",
  "blended",
  "bottle",
  "bottled",
  "bottling",
  "bourbon",
  "cask",
  "casks",
  "distillery",
  "edition",
  "finish",
  "finished",
  "in",
  "irish",
  "limited",
  "malt",
  "malts",
  "of",
  "old",
  "proof",
  "release",
  "rye",
  "scotch",
  "single",
  "strength",
  "the",
  "whiskey",
  "whisky",
  "with",
  "year",
  "years",
]);

/** Compile literal input to bounded TINQL; callers never supply TIN operators. */
export function textSearchQuery(
  input: string,
  { any = false, fuzzy = false, prefix = false } = {},
) {
  const allTokens = [
    ...new Set(
      input
        .normalize("NFKC")
        .toLowerCase()
        .match(
          /[\p{Letter}\p{Number}]+(?:[.'’/-][\p{Letter}\p{Number}]+)*/gu,
        ) ?? [],
    ),
  ].filter((token) => !["and", "or", "not"].includes(token));
  const distinctiveTokens = any
    ? allTokens.filter((token) => !BROAD_QUERY_STOP_TOKENS.has(token))
    : allTokens;
  const tokens = (
    distinctiveTokens.length ? distinctiveTokens : allTokens
  ).slice(0, 32);
  return tokens
    .map((token) => {
      const literal = `"${token}"`;
      // Numeric release identifiers must never expand to neighboring identifiers.
      if (fuzzy && /^\p{Letter}{5,}$/u.test(token)) return `${token}~1`;
      if (prefix && /^\p{Letter}{3,}$/u.test(token)) return `${token}*`;
      return literal;
    })
    .join(any ? " OR " : " AND ");
}

export function bottleTextPredicate(query: string) {
  if (!query) return sql`FALSE`;
  return sql`(${bottles.searchNames} ==> ${`(${query})^2`} OR ${bottles.searchTerms} ==> ${query})`;
}

export const bottleTextScore = sql<number>`tin.score(${bottles}.ctid)`;

export function entityTextPredicate(query: string) {
  if (!query) return sql`FALSE`;
  return sql`${entities.searchNames} ==> ${query}`;
}

export function bottleSeriesTextPredicate(query: string) {
  if (!query) return sql`FALSE`;
  return sql`${bottleSeries.searchNames} ==> ${query}`;
}
