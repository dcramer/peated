// List helpers
export function mockPage<T>(items: T[], cursor: number, limit: number) {
  const offset = (cursor - 1) * limit;
  const results = items.slice(offset, offset + limit);

  return {
    results,
    rel: {
      nextCursor: offset + limit < items.length ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}

export function includesQuery(query: string, ...values: (string | null)[]) {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    normalizedQuery.length === 0 ||
    values.some((value) => value?.toLowerCase().includes(normalizedQuery))
  );
}

type LocatedBottle = {
  category: string | null;
  distillers: {
    country: { id: number } | null;
    region: { id: number } | null;
  }[];
};

// Like the API, a Bottle belongs to the places its distillers are in. Brand and
// bottler locations do not count.
export function mockCategoriesProducedIn<T extends LocatedBottle>(
  bottles: T[],
  isInLocation: (distiller: T["distillers"][number]) => boolean,
) {
  const counts = new Map<T["category"], number>();
  for (const bottle of bottles) {
    if (!bottle.distillers.some(isInLocation)) continue;
    counts.set(bottle.category, (counts.get(bottle.category) ?? 0) + 1);
  }

  const results = [...counts]
    .map(([category, count]) => ({ category, count }))
    .toSorted((left, right) =>
      left.category === null
        ? 1
        : right.category === null
          ? -1
          : left.category.localeCompare(right.category),
    );
  return {
    results,
    totalCount: results.reduce((total, { count }) => total + count, 0),
  };
}
