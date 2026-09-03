import type { BOTTLE_LIST_SORT_OPTIONS } from "@peated/server/constants";
import type { ORPCQueryUtils } from "@peated/web/lib/orpc/context";

export type SeriesBottleSort = (typeof BOTTLE_LIST_SORT_OPTIONS)[number];
export type SeriesLibraryFilter = "all" | "in" | "out";

type SeriesBottleQuery = {
  cursor: number;
  library: SeriesLibraryFilter;
  seriesId: number;
  sort: SeriesBottleSort;
};

/** Keeps the server prefetch and client read on the same request-specific key. */
export const seriesPageQueries = {
  bottles: (orpc: ORPCQueryUtils, query: SeriesBottleQuery) =>
    orpc.bottles.list.queryOptions({
      input: {
        cursor: query.cursor,
        library: query.library === "all" ? undefined : query.library,
        limit: 25,
        series: query.seriesId,
        sort: query.sort,
      },
    }),
};
