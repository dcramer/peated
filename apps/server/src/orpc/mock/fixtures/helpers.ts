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
