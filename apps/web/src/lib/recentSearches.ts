import { z } from "zod";

const RECENT_SEARCHES_KEY = "peated:recent-searches";
const RECENT_SEARCHES_LIMIT = 3;
const RecentSearchesSchema = z.array(z.string());

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export function addRecentSearch(
  searches: readonly string[],
  query: string,
): string[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [...searches];

  const key = normalizedQuery.toLocaleLowerCase();
  return [
    normalizedQuery,
    ...searches.filter(
      (search) => normalizeSearchQuery(search).toLocaleLowerCase() !== key,
    ),
  ].slice(0, RECENT_SEARCHES_LIMIT);
}

export function parseRecentSearches(value: string) {
  try {
    const result = RecentSearchesSchema.safeParse(JSON.parse(value));
    if (!result.success) return [];

    const searches: string[] = [];
    for (const search of result.data) {
      const normalizedSearch = normalizeSearchQuery(search);
      if (
        normalizedSearch &&
        !searches.some(
          (recent) =>
            recent.toLocaleLowerCase() === normalizedSearch.toLocaleLowerCase(),
        )
      ) {
        searches.push(normalizedSearch);
      }
      if (searches.length === RECENT_SEARCHES_LIMIT) break;
    }
    return searches;
  } catch {
    return [];
  }
}

export function readRecentSearches() {
  try {
    return parseRecentSearches(
      window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]",
    );
  } catch {
    return [];
  }
}

export function writeRecentSearches(searches: readonly string[]) {
  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(searches.slice(0, RECENT_SEARCHES_LIMIT)),
    );
  } catch {
    // Search still works when browser storage is unavailable.
  }
}
