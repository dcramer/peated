import { sql } from "drizzle-orm";
import { bottles } from "../db/schema";

/** Compile literal input to bounded TINQL; callers never supply TIN operators. */
export function bottleTextQuery(
  input: string,
  { any = false, fuzzy = false, prefix = false } = {},
) {
  const tokens = [
    ...new Set(
      input
        .normalize("NFKC")
        .toLowerCase()
        .match(
          /[\p{Letter}\p{Number}]+(?:[.'’/-][\p{Letter}\p{Number}]+)*/gu,
        ) ?? [],
    ),
  ]
    .filter((token) => !["and", "or", "not"].includes(token))
    .slice(0, 32);
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
